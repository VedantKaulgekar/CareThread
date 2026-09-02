const { v4: uuidv4 } = require("uuid");
const { getClient, DEFAULT_MODEL } = require("./groqClient");
const intakeAgent = require("./intakeAgent");
const dbClient = require("../db");
const emailClient = require("../notifications/emailClient");

const MODEL = DEFAULT_MODEL;
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT = `You are the CareThread Assistant, embedded in a clinical drug-trial coordination app.
You can look things up and take real actions for the person you're talking to, using only the tools provided — never invent data or claim to have done something you didn't call a tool for.

Rules:
- Only act within the current user's own workspaces/visits/patients — tools are already scoped to them, you don't need to ask for IDs the user wouldn't know; use names and let the tool resolve them.
- Confirm destructive or scheduling actions succeeded by reporting exactly what the tool returned, not what you assume happened.
- If a tool call fails or returns an error, tell the user plainly what went wrong — don't paper over it.
- Keep replies short and conversational — a sentence or two, not a report.
- You are not a doctor and must never give medical advice, diagnoses, or dosage recommendations of your own.`;

// ---------- Tool schema (role-aware) ----------

function toolsForRole(role) {
  const shared = [
    {
      type: "function",
      function: {
        name: "list_my_workspaces",
        description:
          "List the trial workspaces the current user is part of (as doctor or patient).",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "list_upcoming_visits",
        description:
          "List the current user's upcoming (scheduled or active) visits, soonest first.",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

  if (role === "doctor") {
    return [
      ...shared,
      {
        type: "function",
        function: {
          name: "list_patients_in_workspace",
          description:
            "List patients enrolled in one of the doctor's workspaces.",
          parameters: {
            type: "object",
            properties: {
              workspace_title: {
                type: "string",
                description:
                  "The workspace's title, or part of it — matched case-insensitively.",
              },
            },
            required: ["workspace_title"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schedule_visit",
          description:
            "Schedule a new visit for a patient in one of the doctor's workspaces. Sends confirmation emails automatically.",
          parameters: {
            type: "object",
            properties: {
              workspace_title: {
                type: "string",
                description: "The workspace's title, or part of it.",
              },
              patient_name: {
                type: "string",
                description: "The patient's name, or part of it.",
              },
              scheduled_at_iso: {
                type: "string",
                description:
                  "ISO 8601 datetime for the visit, e.g. 2026-09-10T14:00:00",
              },
              title: {
                type: "string",
                description: "Optional short title for the visit.",
              },
            },
            required: ["workspace_title", "patient_name", "scheduled_at_iso"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "cancel_visit",
          description: "Cancel a scheduled (not yet started) visit.",
          parameters: {
            type: "object",
            properties: {
              patient_name: {
                type: "string",
                description: "The patient's name on the visit to cancel.",
              },
              scheduled_at_iso: {
                type: "string",
                description:
                  "The visit's scheduled time, to disambiguate if the patient has more than one upcoming visit.",
              },
            },
            required: ["patient_name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_pending_visit_requests",
          description:
            "List patient-submitted visit requests awaiting the doctor's response, most urgent first.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "remove_patient_from_workspace",
          description:
            "Remove (withdraw) a patient from one of the doctor's workspaces. Their visit history is kept; any upcoming visits with them in that workspace are cancelled.",
          parameters: {
            type: "object",
            properties: {
              workspace_title: {
                type: "string",
                description: "The workspace's title, or part of it.",
              },
              patient_name: {
                type: "string",
                description: "The patient's name, or part of it.",
              },
            },
            required: ["workspace_title", "patient_name"],
          },
        },
      },
    ];
  }

  // patient
  return [
    ...shared,
    {
      type: "function",
      function: {
        name: "submit_concern",
        description:
          "Submit a health concern/message to the doctor on behalf of the patient. It gets triage-classified for urgency automatically.",
        parameters: {
          type: "object",
          properties: {
            workspace_title: {
              type: "string",
              description: "Which workspace/trial this concern is about.",
            },
            concern_text: {
              type: "string",
              description: "The patient's concern, in their own words.",
            },
          },
          required: ["workspace_title", "concern_text"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_latest_visit_summary",
        description:
          "Get the AI after-visit summary from the patient's most recently completed visit.",
        parameters: {
          type: "object",
          properties: {
            workspace_title: {
              type: "string",
              description: "Optional — narrow to a specific workspace.",
            },
          },
        },
      },
    },
  ];
}

// ---------- Tool execution ----------

async function findWorkspaceForDoctor(doctorId, titleFragment) {
  const result = await dbClient.query(
    `SELECT * FROM workspaces WHERE doctor_id = $1 AND title ILIKE $2 ORDER BY created_at DESC LIMIT 1`,
    [doctorId, `%${titleFragment}%`],
  );
  return result.rows[0] || null;
}

async function findWorkspaceForPatient(patientId, titleFragment) {
  const params = titleFragment
    ? [patientId, `%${titleFragment}%`]
    : [patientId];
  const result = await dbClient.query(
    `
    SELECT w.* FROM workspaces w
    JOIN workspace_patients wp ON wp.workspace_id = w.id
    WHERE wp.patient_id = $1 AND wp.status = 'active'
    ${titleFragment ? "AND w.title ILIKE $2" : ""}
    ORDER BY w.created_at DESC LIMIT 1
    `,
    params,
  );
  return result.rows[0] || null;
}

async function findPatientInWorkspace(workspaceId, nameFragment) {
  const result = await dbClient.query(
    `
    SELECT u.* FROM users u
    JOIN workspace_patients wp ON wp.patient_id = u.id
    WHERE wp.workspace_id = $1 AND wp.status = 'active' AND u.name ILIKE $2
    LIMIT 1
    `,
    [workspaceId, `%${nameFragment}%`],
  );
  return result.rows[0] || null;
}

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function genUniqueRoomCode() {
  while (true) {
    const candidate = genRoomCode();
    const existing = await dbClient.query(
      "SELECT id FROM scheduled_visits WHERE room_code = $1",
      [candidate],
    );
    if (existing.rows.length === 0) return candidate;
  }
}

/**
 * Executes one tool call. Returns a plain object/string (JSON-stringified
 * before being sent back to the model) — never throws; errors are
 * returned as { error } so the model can relay them, and so a bad call
 * can't crash the whole chat turn.
 *
 * @returns {{ result: any, action: string|null }} action is a short
 *   human-readable description used to pop a toast notification on
 *   success, or null for read-only calls.
 */
async function executeTool(name, args, user) {
  try {
    switch (name) {
      case "list_my_workspaces": {
        const query =
          user.role === "doctor"
            ? `SELECT id, title, drug_name, status FROM workspaces WHERE doctor_id = $1 ORDER BY created_at DESC`
            : `
              SELECT w.id, w.title, w.drug_name, w.status FROM workspaces w
              JOIN workspace_patients wp ON wp.workspace_id = w.id
              WHERE wp.patient_id = $1 AND wp.status = 'active'
              ORDER BY w.created_at DESC
            `;
        const result = await dbClient.query(query, [user.id]);
        return { result: { workspaces: result.rows }, action: null };
      }

      case "list_upcoming_visits": {
        const column = user.role === "doctor" ? "doctor_id" : "patient_id";
        const result = await dbClient.query(
          `
          SELECT sv.title, sv.scheduled_at, sv.status, sv.room_code, w.title AS workspace_title,
            other.name AS other_party_name
          FROM scheduled_visits sv
          JOIN workspaces w ON w.id = sv.workspace_id
          JOIN users other ON other.id = ${user.role === "doctor" ? "sv.patient_id" : "sv.doctor_id"}
          WHERE sv.${column} = $1 AND sv.status IN ('scheduled', 'active')
          ORDER BY sv.scheduled_at ASC
          LIMIT 15
          `,
          [user.id],
        );
        return { result: { visits: result.rows }, action: null };
      }

      case "list_patients_in_workspace": {
        if (user.role !== "doctor")
          return {
            result: { error: "Only doctors can list patients." },
            action: null,
          };
        const workspace = await findWorkspaceForDoctor(
          user.id,
          args.workspace_title,
        );
        if (!workspace)
          return {
            result: {
              error: `No workspace matching "${args.workspace_title}" found.`,
            },
            action: null,
          };
        const result = await dbClient.query(
          `
          SELECT u.name, u.email, wp.status AS enrollment_status
          FROM workspace_patients wp
          JOIN users u ON u.id = wp.patient_id
          WHERE wp.workspace_id = $1
          ORDER BY wp.joined_at DESC
          `,
          [workspace.id],
        );
        return {
          result: { workspace: workspace.title, patients: result.rows },
          action: null,
        };
      }

      case "schedule_visit": {
        if (user.role !== "doctor")
          return {
            result: { error: "Only doctors can schedule visits." },
            action: null,
          };
        const workspace = await findWorkspaceForDoctor(
          user.id,
          args.workspace_title,
        );
        if (!workspace)
          return {
            result: {
              error: `No workspace matching "${args.workspace_title}" found.`,
            },
            action: null,
          };
        const patient = await findPatientInWorkspace(
          workspace.id,
          args.patient_name,
        );
        if (!patient)
          return {
            result: {
              error: `No patient matching "${args.patient_name}" enrolled in ${workspace.title}.`,
            },
            action: null,
          };

        const scheduledAt = new Date(args.scheduled_at_iso);
        if (isNaN(scheduledAt.getTime()))
          return {
            result: {
              error: `"${args.scheduled_at_iso}" isn't a valid date/time.`,
            },
            action: null,
          };

        const id = uuidv4();
        const roomCode = await genUniqueRoomCode();
        await dbClient.query(
          `
          INSERT INTO scheduled_visits (id, workspace_id, patient_id, doctor_id, room_code, title, scheduled_at, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled')
          `,
          [
            id,
            workspace.id,
            patient.id,
            user.id,
            roomCode,
            args.title?.trim() || null,
            scheduledAt.toISOString(),
          ],
        );
        const visitResult = await dbClient.query(
          "SELECT * FROM scheduled_visits WHERE id = $1",
          [id],
        );
        const visit = visitResult.rows[0];

        try {
          const doctorResult = await dbClient.query(
            "SELECT id, name, email FROM users WHERE id = $1",
            [user.id],
          );
          const visitScheduledEmail = require("../notifications/visitScheduledEmail");
          await visitScheduledEmail.sendVisitScheduledEmails({
            visit,
            workspaceTitle: workspace.title,
            drugName: workspace.drug_name,
            doctor: doctorResult.rows[0],
            patient,
            senderRole: "doctor",
            appUrl: process.env.APP_URL || "",
          });
        } catch (emailError) {
          console.warn(
            "Agent-scheduled visit email skipped:",
            emailError.message,
          );
        }

        return {
          result: {
            visit: {
              title: visit.title,
              scheduled_at: visit.scheduled_at,
              room_code: visit.room_code,
              patient: patient.name,
            },
          },
          action: `Scheduled a visit for ${patient.name} on ${scheduledAt.toLocaleString()}`,
        };
      }

      case "cancel_visit": {
        if (user.role !== "doctor")
          return {
            result: { error: "Only doctors can cancel visits." },
            action: null,
          };
        const params = [user.id, `%${args.patient_name}%`];
        let dateFilter = "";
        if (args.scheduled_at_iso) {
          dateFilter = "AND sv.scheduled_at = $3";
          params.push(new Date(args.scheduled_at_iso).toISOString());
        }
        const result = await dbClient.query(
          `
          SELECT sv.* FROM scheduled_visits sv
          JOIN users u ON u.id = sv.patient_id
          WHERE sv.doctor_id = $1 AND u.name ILIKE $2 AND sv.status = 'scheduled' ${dateFilter}
          ORDER BY sv.scheduled_at ASC
          `,
          params,
        );
        if (result.rows.length === 0)
          return {
            result: {
              error: `No matching scheduled visit found for "${args.patient_name}".`,
            },
            action: null,
          };
        if (result.rows.length > 1) {
          return {
            result: {
              error:
                "More than one matching visit found — please specify the date/time to disambiguate.",
              candidates: result.rows.map((v) => ({
                scheduled_at: v.scheduled_at,
                title: v.title,
              })),
            },
            action: null,
          };
        }
        const visit = result.rows[0];
        await dbClient.query(
          `UPDATE scheduled_visits SET status = 'cancelled' WHERE id = $1`,
          [visit.id],
        );
        return {
          result: { cancelled: true, scheduled_at: visit.scheduled_at },
          action: `Cancelled the visit scheduled for ${new Date(visit.scheduled_at).toLocaleString()}`,
        };
      }

      case "list_pending_visit_requests": {
        if (user.role !== "doctor")
          return {
            result: { error: "Only doctors can view visit requests." },
            action: null,
          };
        const result = await dbClient.query(
          `
          SELECT vr.concern_text, vr.urgency, vr.created_at, u.name AS patient_name, w.title AS workspace_title
          FROM visit_requests vr
          JOIN users u ON u.id = vr.patient_id
          JOIN workspaces w ON w.id = vr.workspace_id
          WHERE w.doctor_id = $1 AND vr.status = 'pending'
          ORDER BY CASE vr.urgency WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'unclear' THEN 2 ELSE 3 END, vr.created_at DESC
          LIMIT 15
          `,
          [user.id],
        );
        return { result: { requests: result.rows }, action: null };
      }

      case "remove_patient_from_workspace": {
        if (user.role !== "doctor")
          return {
            result: { error: "Only doctors can remove patients." },
            action: null,
          };
        const workspace = await findWorkspaceForDoctor(
          user.id,
          args.workspace_title,
        );
        if (!workspace)
          return {
            result: {
              error: `No workspace matching "${args.workspace_title}" found.`,
            },
            action: null,
          };
        const patient = await findPatientInWorkspace(
          workspace.id,
          args.patient_name,
        );
        if (!patient)
          return {
            result: {
              error: `No active patient matching "${args.patient_name}" enrolled in ${workspace.title}.`,
            },
            action: null,
          };

        await dbClient.query(
          "UPDATE workspace_patients SET status = 'withdrawn' WHERE workspace_id = $1 AND patient_id = $2",
          [workspace.id, patient.id],
        );
        const cancelled = await dbClient.query(
          `
          UPDATE scheduled_visits SET status = 'cancelled'
          WHERE workspace_id = $1 AND patient_id = $2 AND status IN ('scheduled', 'active')
          RETURNING id
          `,
          [workspace.id, patient.id],
        );

        return {
          result: {
            removed: true,
            patient: patient.name,
            cancelled_visits: cancelled.rows.length,
          },
          action: `Removed ${patient.name} from ${workspace.title}${cancelled.rows.length ? ` (cancelled ${cancelled.rows.length} upcoming visit${cancelled.rows.length > 1 ? "s" : ""})` : ""}`,
        };
      }

      case "submit_concern": {
        if (user.role !== "patient")
          return {
            result: { error: "Only patients can submit concerns." },
            action: null,
          };
        const workspace = await findWorkspaceForPatient(
          user.id,
          args.workspace_title,
        );
        if (!workspace)
          return {
            result: {
              error: `You're not enrolled in a workspace matching "${args.workspace_title}".`,
            },
            action: null,
          };

        let classification = {
          urgency: "unclear",
          reasoning: "AI triage unavailable",
        };
        try {
          classification = await intakeAgent.classifyConcern(args.concern_text);
        } catch (aiError) {
          console.warn("Agent intake classification skipped:", aiError.message);
        }

        const id = uuidv4();
        await dbClient.query(
          `
          INSERT INTO visit_requests (id, workspace_id, patient_id, concern_text, urgency, urgency_reasoning, status)
          VALUES ($1,$2,$3,$4,$5,$6,'pending')
          `,
          [
            id,
            workspace.id,
            user.id,
            args.concern_text,
            classification.urgency,
            classification.reasoning,
          ],
        );

        if (classification.urgency === "high") {
          const doctorResult = await dbClient.query(
            "SELECT email, name FROM users WHERE id = $1",
            [workspace.doctor_id],
          );
          const doctor = doctorResult.rows[0];
          await emailClient.sendEmail({
            toEmail: doctor?.email,
            subject: `High-urgency patient message — ${workspace.title}`,
            message: `Hi ${doctor?.name || "Doctor"},\n\nA patient submitted a high-urgency concern in ${workspace.title}:\n\n"${args.concern_text}"\n\nPlease review it in your CareThread dashboard.\n\n— CareThread`,
            kind: "urgent_intake",
            recipientUserId: workspace.doctor_id,
          });
        }

        return {
          result: { submitted: true, urgency: classification.urgency },
          action: `Sent your concern to your doctor (triaged as ${classification.urgency} urgency)`,
        };
      }

      case "get_latest_visit_summary": {
        if (user.role !== "patient")
          return {
            result: {
              error:
                "Only patients can view their own visit summaries this way.",
            },
            action: null,
          };
        const params = [user.id];
        let workspaceFilter = "";
        if (args.workspace_title) {
          workspaceFilter = "AND w.title ILIKE $2";
          params.push(`%${args.workspace_title}%`);
        }
        const result = await dbClient.query(
          `
          SELECT sv.ai_summary, sv.completed_at, w.title AS workspace_title
          FROM scheduled_visits sv
          JOIN workspaces w ON w.id = sv.workspace_id
          WHERE sv.patient_id = $1 AND sv.status = 'completed' AND sv.ai_summary IS NOT NULL ${workspaceFilter}
          ORDER BY sv.completed_at DESC
          LIMIT 1
          `,
          params,
        );
        if (result.rows.length === 0)
          return {
            result: { error: "No completed visit with a summary was found." },
            action: null,
          };
        return { result: result.rows[0], action: null };
      }

      default:
        return { result: { error: `Unknown tool: ${name}` }, action: null };
    }
  } catch (error) {
    console.error(`Chat agent tool "${name}" failed:`, error.message);
    return {
      result: { error: "Something went wrong running that action." },
      action: null,
    };
  }
}

/**
 * Runs the tool-calling loop for one chat turn.
 * @param {Array<{role: string, content: string}>} messages - full
 *   conversation so far, ending with the latest user message.
 * @param {{id: string, role: string}} user
 * @returns {{ reply: string, actions: string[] }}
 */
async function runChat(messages, user) {
  const client = getClient();
  const tools = toolsForRole(user.role);
  const actions = [];

  let working = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: working,
      tools,
      temperature: 0.3,
      max_tokens: 700,
    });

    const choice = response.choices[0];
    const message = choice.message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { reply: message.content?.trim() || "", actions };
    }

    working.push(message);

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const { result, action } = await executeTool(
        toolCall.function.name,
        args,
        user,
      );
      if (action) actions.push(action);
      working.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply:
      "I ran into trouble finishing that — could you try rephrasing or breaking it into smaller steps?",
    actions,
  };
}

module.exports = { runChat };
