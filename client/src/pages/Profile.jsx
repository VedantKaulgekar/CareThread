import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, useAuth } from '../AuthContext.jsx';

export default function Profile() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    qualification: '',
    experience: '',
    hospital: '',
    bio: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /*
   * =========================================================
   * LOAD DOCTOR PROFILE
   * =========================================================
   *
   * First try the profile API.
   *
   * If your backend does not have /profile yet,
   * we fall back to the authenticated user object.
   */

  async function loadProfile() {
    try {
      const data = await api('/profile', {
        token,
      });

      const doctor = data.user || data.profile || data;

      setProfile({
        name: doctor.name || '',
        email: doctor.email || '',
        phone: doctor.phone || '',
        specialization:
          doctor.specialization || '',
        qualification:
          doctor.qualification || '',
        experience:
          doctor.experience || '',
        hospital:
          doctor.hospital || '',
        bio:
          doctor.bio || '',
      });

    } catch (err) {
      /*
       * Fallback to current authenticated user.
       */

      setProfile({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        specialization:
          user?.specialization || '',
        qualification:
          user?.qualification || '',
        experience:
          user?.experience || '',
        hospital:
          user?.hospital || '',
        bio:
          user?.bio || '',
      });

      console.log(
        'Profile API not available yet. Using auth user.',
        err
      );
    }
  }

  useEffect(() => {
    if (token) {
      loadProfile();
    }
  }, [token]);


  /*
   * =========================================================
   * HANDLE CHANGE
   * =========================================================
   */

  function handleChange(e) {
    const { name, value } = e.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  }


  /*
   * =========================================================
   * SAVE PROFILE
   * =========================================================
   */

  async function handleSave(e) {
    e.preventDefault();

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      /*
       * This uses PUT /profile.
       *
       * If the backend endpoint is not implemented yet,
       * the error will be shown without breaking the page.
       */

      await api('/profile', {
        method: 'PUT',
        token,
        body: profile,
      });

      setSuccess(
        'Profile updated successfully.'
      );

      setEditing(false);

      await loadProfile();

    } catch (err) {
      console.error(
        'Profile update failed:',
        err
      );

      setError(
        err?.message ||
          'Unable to update profile.'
      );
    } finally {
      setSaving(false);
    }
  }


  /*
   * =========================================================
   * CANCEL EDIT
   * =========================================================
   */

  async function handleCancel() {
    setError('');
    setSuccess('');

    setEditing(false);

    await loadProfile();
  }


  /*
   * =========================================================
   * AVATAR INITIAL
   * =========================================================
   */

  const doctorName =
    profile.name ||
    user?.name ||
    'Doctor';

  const initial =
    doctorName
      .trim()
      .charAt(0)
      .toUpperCase() || 'D';


  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFD',
      }}
    >

      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <header
        style={{
          height: 62,
          background: '#FFFFFF',
          borderBottom:
            '1px solid rgba(30,50,90,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          padding:
            '0 28px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >

          <button
            type="button"
            onClick={() =>
              navigate('/doctor')
            }
            style={{
              border: 'none',
              background:
                'transparent',
              cursor: 'pointer',
              color: '#0758D8',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← Dashboard
          </button>

          <span
            style={{
              color: '#C1C7D0',
            }}
          >
            /
          </span>

          <span
            style={{
              color: '#687386',
              fontSize: 13,
            }}
          >
            Profile
          </span>

        </div>


        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >

          <span
            style={{
              fontSize: 12,
              color: '#7A8392',
            }}
          >
            CareThread
          </span>

          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background:
                'linear-gradient(135deg,#D8E5F5,#A9BED9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'center',
              color: '#40516A',
              fontWeight: 700,
            }}
          >
            {initial}
          </div>

        </div>

      </header>


      {/* =====================================================
          PAGE
      ===================================================== */}

      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding:
            '34px 30px 70px',
        }}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'space-between',
            marginBottom: 26,
          }}
        >

          <div>

            <div
              style={{
                color: '#7A8392',
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              Doctor Portal
              {'  ›  '}
              Profile
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 30,
                color: '#1E293B',
              }}
            >
              My Profile
            </h1>

            <p
              style={{
                margin:
                  '7px 0 0',
                color: '#7A8392',
                fontSize: 14,
              }}
            >
              View and manage your professional
              information.
            </p>

          </div>


          {!editing && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setSuccess('');
                setEditing(true);
              }}
              style={editButtonStyle}
            >
              ✎ Edit Profile
            </button>
          )}

        </div>


        {/* =================================================
            ALERTS
        ================================================= */}

        {success && (
          <div
            style={{
              marginBottom: 18,
              padding:
                '12px 15px',
              borderRadius: 9,
              background:
                'rgba(15,110,86,0.08)',
              border:
                '1px solid rgba(15,110,86,0.15)',
              color: '#0F6E56',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 18,
              padding:
                '12px 15px',
              borderRadius: 9,
              background:
                'rgba(200,86,47,0.08)',
              border:
                '1px solid rgba(200,86,47,0.16)',
              color: '#A33D1C',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}


        {/* =================================================
            PROFILE CARD
        ================================================= */}

        <section
          style={{
            background: '#FFFFFF',
            border:
              '1px solid rgba(30,50,90,0.07)',
            borderRadius: 14,
            padding: 30,
            boxShadow:
              '0 8px 30px rgba(50,80,130,0.05)',
            marginBottom: 22,
          }}
        >

          {/* PROFILE HEADER */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              paddingBottom: 25,
              borderBottom:
                '1px solid #EDF0F4',
              marginBottom: 25,
            }}
          >

            <div
              style={{
                width: 82,
                height: 82,
                minWidth: 82,
                borderRadius: '50%',
                background:
                  'linear-gradient(135deg,#D8E5F5,#A9BED9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'center',
                color: '#40516A',
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {initial}
            </div>


            <div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  color: '#1E293B',
                }}
              >
                {doctorName}
              </h2>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 13,
                  color: '#0758D8',
                  fontWeight: 600,
                }}
              >
                {profile.specialization ||
                  'Medical Professional'}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: '#7A8392',
                }}
              >
                {profile.email ||
                  'No email available'}
              </div>

            </div>

          </div>


          {/* =================================================
              DETAILS / EDIT FORM
          ================================================= */}

          {editing ? (

            <form onSubmit={handleSave}>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: 20,
                }}
              >

                <ProfileInput
                  label="Full Name"
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  placeholder="Dr. Sarah Smith"
                />

                <ProfileInput
                  label="Email Address"
                  name="email"
                  type="email"
                  value={profile.email}
                  onChange={handleChange}
                  placeholder="doctor@example.com"
                />

                <ProfileInput
                  label="Phone Number"
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  placeholder="+91 XXXXX XXXXX"
                />

                <ProfileInput
                  label="Specialization"
                  name="specialization"
                  value={
                    profile.specialization
                  }
                  onChange={handleChange}
                  placeholder="Cardiology"
                />

                <ProfileInput
                  label="Qualification"
                  name="qualification"
                  value={
                    profile.qualification
                  }
                  onChange={handleChange}
                  placeholder="MBBS, MD"
                />

                <ProfileInput
                  label="Experience"
                  name="experience"
                  value={
                    profile.experience
                  }
                  onChange={handleChange}
                  placeholder="8 years"
                />

                <div
                  style={{
                    gridColumn:
                      '1 / -1',
                  }}
                >

                  <ProfileInput
                    label="Hospital / Clinic"
                    name="hospital"
                    value={
                      profile.hospital
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="City Care Hospital"
                  />

                </div>

              </div>


              {/* BIO */}

              <div
                style={{
                  marginTop: 20,
                }}
              >

                <label
                  style={labelStyle}
                >
                  Professional Bio
                </label>

                <textarea
                  name="bio"
                  value={profile.bio}
                  onChange={
                    handleChange
                  }
                  placeholder="Tell patients a little about your professional background..."
                  rows={5}
                  style={{
                    ...inputStyle,
                    height: 'auto',
                    padding:
                      '12px 13px',
                    resize:
                      'vertical',
                    lineHeight: 1.5,
                  }}
                />

              </div>


              {/* ACTIONS */}

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'flex-end',
                  gap: 10,
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop:
                    '1px solid #EDF0F4',
                }}
              >

                <button
                  type="button"
                  onClick={
                    handleCancel
                  }
                  style={
                    secondaryButtonStyle
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={
                    primaryButtonStyle
                  }
                >
                  {saving
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>

              </div>

            </form>

          ) : (

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: 20,
              }}
            >

              <DetailItem
                label="Full Name"
                value={
                  profile.name ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Email Address"
                value={
                  profile.email ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Phone Number"
                value={
                  profile.phone ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Specialization"
                value={
                  profile.specialization ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Qualification"
                value={
                  profile.qualification ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Experience"
                value={
                  profile.experience ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Hospital / Clinic"
                value={
                  profile.hospital ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Account Role"
                value="Doctor"
              />

            </div>

          )}

        </section>


        {/* =================================================
            PROFESSIONAL BIO
        ================================================= */}

        <section
          style={{
            background: '#FFFFFF',
            border:
              '1px solid rgba(30,50,90,0.07)',
            borderRadius: 14,
            padding: 26,
            boxShadow:
              '0 8px 30px rgba(50,80,130,0.05)',
          }}
        >

          <h2
            style={{
              margin: 0,
              fontSize: 17,
              color: '#1E293B',
            }}
          >
            Professional Bio
          </h2>

          <p
            style={{
              margin:
                '10px 0 0',
              color: '#687386',
              fontSize: 13.5,
              lineHeight: 1.7,
            }}
          >
            {profile.bio ||
              'No professional bio has been added yet. Click "Edit Profile" to add information about your professional background.'}
          </p>

        </section>

      </main>

    </div>
  );
}


/* =========================================================
   PROFILE INPUT
========================================================= */

function ProfileInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
}) {
  return (
    <div>

      <label
        style={labelStyle}
      >
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={inputStyle}
      />

    </div>
  );
}


/* =========================================================
   DETAIL ITEM
========================================================= */

function DetailItem({
  label,
  value,
}) {
  return (
    <div
      style={{
        padding:
          '14px 15px',
        background: '#FAFBFD',
        border:
          '1px solid #EDF0F4',
        borderRadius: 9,
      }}
    >

      <div
        style={{
          fontSize: 11,
          color: '#7A8392',
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          color: '#354052',
          fontWeight: 600,
        }}
      >
        {value}
      </div>

    </div>
  );
}


/* =========================================================
   STYLES
========================================================= */

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#5F6979',
  marginBottom: 7,
};

const inputStyle = {
  width: '100%',
  minHeight: 44,
  padding:
    '0 13px',
  border:
    '1px solid #DFE4EC',
  borderRadius: 8,
  background: '#FFFFFF',
  outline: 'none',
  fontSize: 13,
  color: '#354052',
  boxSizing: 'border-box',
};

const editButtonStyle = {
  height: 40,
  padding:
    '0 17px',
  border:
    '1px solid #D5DEEB',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#0758D8',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryButtonStyle = {
  height: 42,
  padding:
    '0 20px',
  border: 'none',
  borderRadius: 8,
  background:
    'linear-gradient(135deg,#0758D8,#164BC6)',
  color: '#FFFFFF',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  height: 42,
  padding:
    '0 18px',
  border:
    '1px solid #D5DCE6',
  borderRadius: 8,
  background: '#FFFFFF',
  color: '#596579',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};