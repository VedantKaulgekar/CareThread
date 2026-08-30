import React, { useState } from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { api, useAuth } from "../AuthContext.jsx";

import { MdMedicalServices } from "react-icons/md";
import { FaHospitalUser } from "react-icons/fa6";

import { FaEye, FaEyeSlash } from "react-icons/fa";

const initialForm = {
  name: "",
  email: "",
  password: "",
  age: "",
  gender: "",
  phone: "",
  medical_conditions: "",
  specialization: "",
  other_specialization: "",
};

const specializations = [
  "Clinical Pharmacology",
  "Oncology",
  "Cardiology",
  "Neurology",
  "Psychiatry",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Hematology",
  "Infectious Diseases",
  "Internal Medicine",
  "Nephrology",
  "Pulmonology",
  "Rheumatology",
  "Pediatrics",
  "General Medicine",
  "Pharmacology",
  "Clinical Research",
  "Clinical Trial Investigator",
  "Other",
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordValidation(password) {
  return {
    length: password.length >= 6,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  };
}

function validatePassword(password) {
  const rules = getPasswordValidation(password);

  if (!rules.length) {
    return "Password must be at least 6 characters long.";
  }

  if (!rules.letter) {
    return "Password must contain at least one letter.";
  }

  if (!rules.number) {
    return "Password must contain at least one number.";
  }

  return "";
}

function validatePhone(phone) {
  if (!phone) {
    return "Phone number is required.";
  }

  if (!/^\d{10}$/.test(phone)) {
    return "Phone number must contain exactly 10 digits.";
  }

  return "";
}

export default function Signup() {
  const [searchParams] = useSearchParams();

  const [role, setRole] = useState(
    searchParams.get("role") === "doctor"
      ? "doctor"
      : "patient"
  );

  const [form, setForm] = useState(initialForm);

  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({
      ...f,
      [field]: value,
    }));
  }

  function handleEmailChange(value) {
    update("email", value);

    if (value.trim() === "") {
      setEmailError("");
      return;
    }

    if (!emailRegex.test(value.trim())) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  }

  function handlePhoneChange(value) {
    const phone = value
      .replace(/\D/g, "")
      .slice(0, 10);

    update("phone", phone);

    if (phone.length === 0) {
      setPhoneError("");
    } else if (phone.length < 10) {
      setPhoneError("Phone number must contain exactly 10 digits.");
    } else {
      setPhoneError("");
    }
  }

  const passwordRules = getPasswordValidation(form.password);

  const passwordValid =
    passwordRules.length &&
    passwordRules.letter &&
    passwordRules.number;

  const completedRules = [
    passwordRules.length,
    passwordRules.letter,
    passwordRules.number,
  ].filter(Boolean).length;

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!emailRegex.test(form.email.trim())) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    const passwordError = validatePassword(form.password);

    if (passwordError) {
      setPasswordTouched(true);
      setError(passwordError);
      return;
    }

    const phoneValidation = validatePhone(form.phone);

    if (phoneValidation) {
      setPhoneError(phoneValidation);
      setError(phoneValidation);
      return;
    }

    if (role === "patient") {
      if (form.age !== "") {
        const age = Number(form.age);

        if (!Number.isInteger(age) || age < 1 || age > 140) {
          setError("Age must be between 1 and 140.");
          return;
        }
      }
    }

    if (role === "doctor") {
      if (!form.specialization) {
        setError("Please select a specialization.");
        return;
      }

      if (
        form.specialization === "Other" &&
        !form.other_specialization.trim()
      ) {
        setError("Please enter your specialization.");
        return;
      }
    }

    setLoading(true);

    try {
      const finalSpecialization =
        form.specialization === "Other"
          ? form.other_specialization.trim()
          : form.specialization;

      const data = await api("/auth/signup", {
        method: "POST",

        body: {
          ...form,

          name: form.name.trim(),

          email: form.email.trim().toLowerCase(),

          specialization:
            role === "doctor"
              ? finalSpecialization
              : "",

          role,
        },
      });

      login(data.token, data.user);

      navigate(
        role === "doctor"
          ? "/doctor"
          : "/patient"
      );

    } catch (err) {
      const message = err.message || "";
      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes("already registered") ||
        lowerMessage.includes("already exists")
      ) {
        setError(
          "An account with this email already exists. Redirecting you to login..."
        );

        setTimeout(() => {
          navigate("/login");
        }, 1800);

        return;
      }

      setError(
        message || "Unable to create account. Please try again."
      );

    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={wrap}>
        <div className="card" style={panel}>

          <Link
            to="/"
            className="brand"
            style={{
              marginBottom: 24,
              display: "flex",
            }}
          >
            <span className="brand-mark">
              C
            </span>
            CareThread
          </Link>

          <h2
            style={{
              fontSize: 24,
              marginBottom: 6,
            }}
          >
            Create your account
          </h2>

          <p
            className="text-muted text-sm"
            style={{
              marginBottom: 24,
            }}
          >
            {role === "patient"
              ? "A few details help your doctor prepare for your visits."
              : "Set up your investigator profile to start hosting Visit Rooms."
            }
          </p>

          <div className="role-toggle">

            <div
              className={`role-option ${
                role === "doctor" ? "active" : ""
              }`}
              onClick={() => setRole("doctor")}
            >
              <MdMedicalServices className="icon" />

              <span className="label">
                Doctor
              </span>
            </div>

            <div
              className={`role-option ${
                role === "patient" ? "active" : ""
              }`}
              onClick={() => setRole("patient")}
            >
              <FaHospitalUser className="icon" />

              <span className="label">
                Patient
              </span>
            </div>

          </div>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <div className="field">
              <label>
                Full name
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {role === "doctor" && (
                  <span
                    style={{
                      marginRight: 8,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Dr.
                  </span>
                )}

                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    update("name", e.target.value)
                  }
                  placeholder={
                    role === "doctor"
                      ? "Enter your name"
                      : "Enter your name"
                  }
                  autoComplete="name"
                  style={{
                    flex: 1,
                  }}
                />
              </div>
            </div>

            <div className="field-row">

              <div className="field">
                <label>Email</label>

                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    handleEmailChange(e.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{
                    border: emailError
                      ? "1px solid #dc2626"
                      : undefined,
                  }}
                />

                {emailError && (
                  <div style={fieldErrorStyle}>
                    {emailError}
                  </div>
                )}
              </div>

              <div className="field">
                <label>Password</label>

                <div
                  style={{
                    position: "relative",
                  }}
                >
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    value={form.password}
                    onChange={(e) =>
                      update(
                        "password",
                        e.target.value
                      )
                    }
                    onFocus={() =>
                      setPasswordTouched(true)
                    }
                    placeholder="Create a password"
                    autoComplete="new-password"
                    style={{
                      width: "100%",
                      paddingRight: "48px",
                      boxSizing: "border-box",

                      border:
                        passwordTouched &&
                        form.password &&
                        !passwordValid
                          ? "1px solid #dc2626"
                          : undefined,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    style={passwordToggleStyle}
                  >
                    {showPassword
                      ? <FaEyeSlash />
                      : <FaEye />
                    }
                  </button>
                </div>

                {passwordTouched && (
                  <div style={passwordHintsStyle}>

                    <div
                      style={{
                        ...passwordRuleStyle,

                        color:
                          passwordRules.length
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      {passwordRules.length
                        ? "✓"
                        : "•"}{" "}
                      At least 6 characters
                    </div>

                    <div
                      style={{
                        ...passwordRuleStyle,

                        color:
                          passwordRules.letter
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      {passwordRules.letter
                        ? "✓"
                        : "•"}{" "}
                      At least one letter
                    </div>

                    <div
                      style={{
                        ...passwordRuleStyle,

                        color:
                          passwordRules.number
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      {passwordRules.number
                        ? "✓"
                        : "•"}{" "}
                      At least one number
                    </div>

                    <div style={strengthContainerStyle}>
                      <div
                        style={{
                          ...strengthBarStyle,

                          width: `${
                            (completedRules / 3) * 100
                          }%`,

                          background:
                            completedRules === 3
                              ? "#16a34a"
                              : completedRules === 2
                              ? "#f59e0b"
                              : "#dc2626",
                        }}
                      />
                    </div>

                  </div>
                )}

              </div>

            </div>

            {role === "doctor" ? (
              <>
                <div className="field">
                  <label>
                    Phone number
                  </label>

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={form.phone}
                    onChange={(e) =>
                      handlePhoneChange(e.target.value)
                    }
                    placeholder="9876543210"
                    autoComplete="tel"
                    style={{
                      border: phoneError
                        ? "1px solid #dc2626"
                        : undefined,
                    }}
                  />

                  {phoneError && (
                    <div style={fieldErrorStyle}>
                      {phoneError}
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>
                    Medical / Clinical Specialization
                  </label>

                  <select
                    value={form.specialization}
                    onChange={(e) =>
                      update(
                        "specialization",
                        e.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      Select specialization
                    </option>

                    {specializations.map(
                      (specialization) => (
                        <option
                          key={specialization}
                          value={specialization}
                        >
                          {specialization}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {form.specialization === "Other" && (
                  <div className="field">
                    <label>
                      Enter your specialization
                    </label>

                    <input
                      required
                      value={
                        form.other_specialization
                      }
                      onChange={(e) =>
                        update(
                          "other_specialization",
                          e.target.value
                        )
                      }
                      placeholder="Enter your medical or clinical specialization"
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="field-row">

                  <div className="field">
                    <label>Age</label>

                    <input
                      type="number"
                      min="1"
                      max="140"
                      value={form.age}
                      onChange={(e) => {
                        const value =
                          e.target.value;

                        if (value === "") {
                          update("age", "");
                          return;
                        }

                        const age =
                          Number(value);

                        if (
                          age >= 1 &&
                          age <= 140
                        ) {
                          update(
                            "age",
                            value
                          );
                        }
                      }}
                      placeholder="34"
                    />
                  </div>

                  <div className="field">
                    <label>Gender</label>

                    <select
                      value={form.gender}
                      onChange={(e) =>
                        update(
                          "gender",
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Select
                      </option>

                      <option>
                        Female
                      </option>

                      <option>
                        Male
                      </option>

                      <option>
                        Other
                      </option>

                      <option>
                        Prefer not to say
                      </option>
                    </select>
                  </div>

                </div>

                <div className="field">
                  <label>
                    Phone number
                  </label>

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={form.phone}
                    onChange={(e) =>
                      handlePhoneChange(e.target.value)
                    }
                    placeholder="9876543210"
                    autoComplete="tel"
                    style={{
                      border: phoneError
                        ? "1px solid #dc2626"
                        : undefined,
                    }}
                  />

                  {phoneError && (
                    <div style={fieldErrorStyle}>
                      {phoneError}
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>
                    Existing medical conditions / current medication
                  </label>

                  <textarea
                    rows={5}
                    style={{
                      resize: "none",
                    }}
                    value={
                      form.medical_conditions
                    }
                    onChange={(e) =>
                      update(
                        "medical_conditions",
                        e.target.value
                      )
                    }
                    placeholder="e.g. Type 2 diabetes, currently on Metformin"
                  />
                </div>
              </>
            )}

            <button
              className="btn btn-primary btn-block"
              disabled={
                loading ||
                !!emailError ||
                !!phoneError
              }
              style={{
                marginTop: 8,
              }}
            >
              {loading
                ? "Creating account…"
                : `Create ${role} account`}
            </button>

          </form>

          <p
            className="text-sm text-muted"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >
            Already have an account?{" "}

            <Link
              to="/login"
              style={{
                color: "var(--purple)",
                fontWeight: 600,
              }}
            >
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </>
  );
}


const fieldErrorStyle = {
  color: "#dc2626",
  fontSize: "12px",
  marginTop: "6px",
};


const passwordHintsStyle = {
  marginTop: "8px",
  fontSize: "11px",
  lineHeight: "1.7",
};


const passwordRuleStyle = {
  display: "block",
};


const passwordToggleStyle = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",

  border: "none",
  background: "transparent",

  cursor: "pointer",

  padding: "6px",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  color: "#777",
  fontSize: "18px",
};


const strengthContainerStyle = {
  width: "100%",
  height: "4px",

  marginTop: "6px",

  borderRadius: "10px",

  background: "#e5e7eb",

  overflow: "hidden",
};


const strengthBarStyle = {
  height: "100%",

  borderRadius: "10px",

  transition:
    "width 0.2s ease, background 0.2s ease",
};


const wrap = {
  minHeight: "100vh",

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  background:
    "radial-gradient(900px 500px at 20% 0%, #EEEDFE 0%, transparent 55%), radial-gradient(900px 500px at 100% 100%, #E1F5EE 0%, transparent 55%)",

  padding: "40px 24px",
};


const panel = {
  width: 800,
  padding: 50,
  boxShadow: "var(--shadow-lg)",
};