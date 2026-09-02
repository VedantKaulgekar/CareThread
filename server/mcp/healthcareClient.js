const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");

let clientPromise = null;

function createClient() {
  const serverEntry = require.resolve("healthcare-mcp/server/index.js");

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverEntry],
  });

  const client = new Client(
    { name: "carethread", version: "1.0.0" },
    { capabilities: {} },
  );

  transport.onclose = () => {
    console.warn(
      "Healthcare MCP connection closed; will reconnect on next call.",
    );
    clientPromise = null;
  };

  return client.connect(transport).then(() => client);
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = createClient().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

async function callHealthcareTool(toolName, args) {
  const client = await getClient();
  const result = await client.callTool({ name: toolName, arguments: args });

  const textBlock = result?.content?.find((c) => c.type === "text");
  if (!textBlock) {
    throw new Error(`Healthcare MCP tool "${toolName}" returned no content`);
  }

  try {
    return JSON.parse(textBlock.text);
  } catch {
    return { raw: textBlock.text };
  }
}

async function lookupDrug(drugName) {
  return callHealthcareTool("fda_drug_lookup", {
    drug_name: drugName,
    search_type: "general",
  });
}

async function searchClinicalTrials(condition, options = {}) {
  return callHealthcareTool("clinical_trials_search", {
    condition,
    max_results: options.maxResults || 5,
  });
}

async function lookupIcdCode(query) {
  return callHealthcareTool("lookup_icd_code", { description: query });
}

module.exports = {
  getClient,
  callHealthcareTool,
  lookupDrug,
  searchClinicalTrials,
  lookupIcdCode,
};
