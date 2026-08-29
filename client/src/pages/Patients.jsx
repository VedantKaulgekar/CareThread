import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';

export default function Patients() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  /*
   * =========================================================
   * LOAD PATIENT LIST
   * =========================================================
   */

  async function loadPatients() {
    setLoading(true);
    setError('');

    try {
      const data = await api('/patients', {
        token,
      });

      const list =
        data?.patients ||
        data?.users ||
        data ||
        [];

      setPatients(
        Array.isArray(list)
          ? list
          : []
      );

    } catch (err) {
      console.error(
        'Failed to load patients:',
        err
      );

      setError(
        err?.message ||
        'Unable to load patients.'
      );

      setPatients([]);

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (token) {
      loadPatients();
    }
  }, [token]);


  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */

  const filteredPatients = useMemo(() => {

    const query =
      search
        .trim()
        .toLowerCase();

    if (!query) {
      return patients;
    }

    return patients.filter(
      (patient) => {

        const name =
          patient.name ||
          patient.full_name ||
          '';

        const email =
          patient.email ||
          '';

        const phone =
          patient.phone ||
          '';

        const id =
          patient.id ||
          patient.patient_id ||
          '';

        return (
          String(name)
            .toLowerCase()
            .includes(query) ||

          String(email)
            .toLowerCase()
            .includes(query) ||

          String(phone)
            .toLowerCase()
            .includes(query) ||

          String(id)
            .toLowerCase()
            .includes(query)
        );
      }
    );

  }, [patients, search]);


  /*
   * =========================================================
   * OPEN PATIENT DETAILS
   * =========================================================
   */

  async function openPatient(patient) {

    setSelectedPatient(patient);
    setLoadingDetails(true);

    const patientId =
      patient.id ||
      patient._id ||
      patient.patient_id;

    /*
     * Try to get complete patient information.
     *
     * If backend does not yet have the endpoint,
     * the information already present in the patient
     * list will still be displayed.
     */

    try {

      if (!patientId) {
        return;
      }

      const data = await api(
        `/patients/${patientId}`,
        {
          token,
        }
      );

      const details =
        data?.patient ||
        data?.user ||
        data;

      if (details) {
        setSelectedPatient({
          ...patient,
          ...details,
        });
      }

    } catch (err) {

      console.log(
        'Detailed patient endpoint unavailable. Showing available patient information.',
        err
      );

    } finally {
      setLoadingDetails(false);
    }
  }


  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  function getName(patient) {

    return (
      patient?.name ||
      patient?.full_name ||
      'Unnamed Patient'
    );
  }


  function getInitial(patient) {

    return (
      getName(patient)
        .trim()
        .charAt(0)
        .toUpperCase() ||
      'P'
    );
  }


  function getId(patient) {

    return (
      patient?.id ||
      patient?._id ||
      patient?.patient_id ||
      'Not available'
    );
  }


  function getEmail(patient) {

    return (
      patient?.email ||
      'Not provided'
    );
  }


  function getPhone(patient) {

    return (
      patient?.phone ||
      'Not provided'
    );
  }


  function getGender(patient) {

    return (
      patient?.gender ||
      patient?.sex ||
      'Not provided'
    );
  }


  function getAge(patient) {

    if (patient?.age !== undefined) {
      return patient.age;
    }

    if (patient?.date_of_birth) {

      const birth =
        new Date(
          patient.date_of_birth
        );

      const today =
        new Date();

      let age =
        today.getFullYear() -
        birth.getFullYear();

      const month =
        today.getMonth() -
        birth.getMonth();

      if (
        month < 0 ||
        (
          month === 0 &&
          today.getDate() <
            birth.getDate()
        )
      ) {
        age--;
      }

      return age;
    }

    return null;
  }


  function getDOB(patient) {

    return (
      patient?.date_of_birth ||
      patient?.dob ||
      'Not provided'
    );
  }


  function formatDate(value) {

    if (!value) {
      return 'Not available';
    }

    try {

      return new Date(value)
        .toLocaleDateString(
          'en-IN',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }
        );

    } catch {

      return 'Not available';

    }
  }


  function getStatus(patient) {

    return (
      patient?.status ||
      'Active'
    );
  }


  /*
   * =========================================================
   * LOGOUT
   * =========================================================
   */

  function handleLogout() {

    localStorage.removeItem('token');
    localStorage.removeItem('authToken');

    navigate('/login');
  }


  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

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
          height: 64,
          background: '#FFFFFF',
          borderBottom:
            '1px solid rgba(30,50,90,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          padding:
            '0 30px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >

        {/* LEFT */}

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
              color: '#C4CAD3',
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
            Patients
          </span>

        </div>


        {/* RIGHT */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >

          <span
            style={{
              color: '#7A8392',
              fontSize: 12,
            }}
          >
            CareThread
          </span>


          <button
            type="button"
            onClick={() =>
              navigate('/profile')
            }
            style={{
              width: 34,
              height: 34,
              borderRadius:
                '50%',
              border: 'none',
              background:
                'linear-gradient(135deg,#D8E5F5,#A9BED9)',
              color: '#40516A',
              fontWeight: 700,
              cursor:
                'pointer',
            }}
          >
            {(user?.name || 'D')
              .trim()
              .charAt(0)
              .toUpperCase()}
          </button>

        </div>

      </header>


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main
        style={{
          maxWidth: 1200,
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
            alignItems: 'flex-end',
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
              CareThread
              {'  ›  '}
              Patients
            </div>


            <h1
              style={{
                margin: 0,
                fontSize: 30,
                color: '#1E293B',
              }}
            >
              My Patients
            </h1>


            <p
              style={{
                margin:
                  '7px 0 0',
                color: '#7A8392',
                fontSize: 14,
              }}
            >
              View your patients and access
              their clinical information.
            </p>

          </div>


          <div
            style={{
              padding:
                '10px 16px',
              background:
                '#FFFFFF',
              border:
                '1px solid #E7EBF1',
              borderRadius: 9,
            }}
          >

            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#0758D8',
              }}
            >
              {patients.length}
            </span>

            <span
              style={{
                marginLeft: 7,
                color: '#6D7585',
                fontSize: 12,
              }}
            >
              Total Patients
            </span>

          </div>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

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
                '1px solid rgba(200,86,47,0.14)',
              color: '#A33D1C',
              fontSize: 13,
            }}
          >
            {error}
          </div>

        )}


        {/* =================================================
            SEARCH
        ================================================= */}

        <div
          style={{
            background:
              '#FFFFFF',
            border:
              '1px solid rgba(30,50,90,0.07)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 18,
          }}
        >

          <div
            style={{
              position:
                'relative',
            }}
          >

            <span
              style={{
                position:
                  'absolute',
                left: 14,
                top: '50%',
                transform:
                  'translateY(-50%)',
                color: '#8A93A2',
                fontSize: 17,
              }}
            >
              ⌕
            </span>


            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search patients by name, email, phone or ID..."
              style={{
                width: '100%',
                height: 44,
                boxSizing:
                  'border-box',
                border:
                  '1px solid #DFE4EC',
                borderRadius: 9,
                padding:
                  '0 14px 0 42px',
                outline: 'none',
                background:
                  '#FAFBFD',
                color: '#354052',
                fontSize: 13,
              }}
            />

          </div>

        </div>


        {/* =================================================
            PATIENT LIST
        ================================================= */}

        <section
          style={{
            background:
              '#FFFFFF',
            border:
              '1px solid rgba(30,50,90,0.07)',
            borderRadius: 14,
            overflow:
              'hidden',
            boxShadow:
              '0 8px 30px rgba(50,80,130,0.04)',
          }}
        >

          {/* HEADER */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '2.2fr 1.5fr 1.2fr 1fr 90px',
              gap: 15,
              padding:
                '14px 20px',
              background:
                '#FAFBFD',
              borderBottom:
                '1px solid #EDF0F4',
              color: '#7A8392',
              fontSize: 10.5,
              fontWeight: 700,
              textTransform:
                'uppercase',
              letterSpacing:
                0.4,
            }}
          >

            <div>Patient</div>

            <div>Email</div>

            <div>Phone</div>

            <div>Status</div>

            <div>Action</div>

          </div>


          {/* LOADING */}

          {loading && (

            <div
              style={{
                padding: 70,
                textAlign:
                  'center',
                color: '#7A8392',
                fontSize: 13,
              }}
            >
              Loading patients…
            </div>

          )}


          {/* EMPTY */}

          {!loading &&
            filteredPatients.length === 0 && (

              <div
                style={{
                  padding:
                    '70px 30px',
                  textAlign:
                    'center',
                }}
              >

                <div
                  style={{
                    width: 56,
                    height: 56,
                    margin:
                      '0 auto 15px',
                    borderRadius:
                      '50%',
                    background:
                      '#EEF4FF',
                    display: 'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    color: '#0758D8',
                    fontSize: 23,
                  }}
                >
                  ♙
                </div>


                <h3
                  style={{
                    margin: 0,
                    fontSize: 17,
                    color: '#354052',
                  }}
                >
                  {search
                    ? 'No patients found'
                    : 'No patients yet'}
                </h3>


                <p
                  style={{
                    margin:
                      '7px 0 0',
                    color: '#7A8392',
                    fontSize: 13,
                  }}
                >
                  {search
                    ? 'Try another search.'
                    : 'Patients will appear here when they join your visits.'}
                </p>

              </div>

            )}


          {/* PATIENT ROWS */}

          {!loading &&
            filteredPatients.map(
              (patient, index) => {

                const patientId =
                  getId(patient);

                return (

                  <div
                    key={
                      patientId !==
                      'Not available'
                        ? patientId
                        : index
                    }
                    onClick={() =>
                      openPatient(
                        patient
                      )
                    }
                    style={{
                      display:
                        'grid',
                      gridTemplateColumns:
                        '2.2fr 1.5fr 1.2fr 1fr 90px',
                      gap: 15,
                      alignItems:
                        'center',
                      padding:
                        '15px 20px',
                      borderBottom:
                        '1px solid #F0F2F5',
                      cursor:
                        'pointer',
                      transition:
                        'background 0.18s ease, transform 0.18s ease',
                    }}
                    onMouseEnter={(
                      event
                    ) => {
                      event.currentTarget.style.background =
                        '#F8FAFF';
                    }}
                    onMouseLeave={(
                      event
                    ) => {
                      event.currentTarget.style.background =
                        '#FFFFFF';
                    }}
                  >

                    {/* PATIENT */}

                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: 12,
                      }}
                    >

                      <div
                        style={{
                          width: 42,
                          height: 42,
                          minWidth: 42,
                          borderRadius:
                            '50%',
                          background:
                            'linear-gradient(135deg,#E2ECFA,#C5D6EA)',
                          display:
                            'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          color:
                            '#40516A',
                          fontWeight:
                            700,
                          fontSize: 14,
                        }}
                      >
                        {getInitial(
                          patient
                        )}
                      </div>


                      <div>

                        <div
                          style={{
                            fontWeight:
                              600,
                            fontSize:
                              14,
                            color:
                              '#354052',
                          }}
                        >
                          {getName(
                            patient
                          )}
                        </div>


                        <div
                          style={{
                            marginTop:
                              3,
                            color:
                              '#8A93A2',
                            fontSize:
                              11,
                          }}
                        >
                          ID:{' '}
                          {patientId}
                        </div>

                      </div>

                    </div>


                    {/* EMAIL */}

                    <div
                      style={{
                        fontSize:
                          12.5,
                        color:
                          '#596579',
                        overflow:
                          'hidden',
                        textOverflow:
                          'ellipsis',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {getEmail(
                        patient
                      )}
                    </div>


                    {/* PHONE */}

                    <div
                      style={{
                        fontSize:
                          12.5,
                        color:
                          '#596579',
                      }}
                    >
                      {getPhone(
                        patient
                      )}
                    </div>


                    {/* STATUS */}

                    <div>

                      <span
                        style={{
                          display:
                            'inline-flex',
                          alignItems:
                            'center',
                          gap: 6,
                          padding:
                            '5px 9px',
                          borderRadius:
                            20,
                          background:
                            'rgba(15,110,86,0.08)',
                          color:
                            '#0F6E56',
                          fontSize:
                            10.5,
                          fontWeight:
                            600,
                        }}
                      >

                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius:
                              '50%',
                            background:
                              '#0F6E56',
                          }}
                        />

                        {getStatus(
                          patient
                        )}

                      </span>

                    </div>


                    {/* ACTION */}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        openPatient(
                          patient
                        );
                      }}
                      style={{
                        height: 34,
                        padding:
                          '0 12px',
                        border:
                          '1px solid #D7DFEA',
                        background:
                          '#FFFFFF',
                        borderRadius: 7,
                        color:
                          '#0758D8',
                        fontSize:
                          11.5,
                        fontWeight:
                          600,
                        cursor:
                          'pointer',
                      }}
                    >
                      View
                    </button>

                  </div>

                );

              }
            )}

        </section>

      </main>


      {/* =====================================================
          PATIENT DETAILS OVERLAY
      ===================================================== */}

      {selectedPatient && (

        <PatientDetails
          patient={
            selectedPatient
          }
          loading={
            loadingDetails
          }
          getName={
            getName
          }
          getInitial={
            getInitial
          }
          getId={
            getId
          }
          getEmail={
            getEmail
          }
          getPhone={
            getPhone
          }
          getGender={
            getGender
          }
          getAge={
            getAge
          }
          getDOB={
            getDOB
          }
          formatDate={
            formatDate
          }
          getStatus={
            getStatus
          }
          onClose={() =>
            setSelectedPatient(
              null
            )
          }
        />

      )}

    </div>
  );
}


/* =========================================================
   PATIENT DETAILS
========================================================= */

function PatientDetails({
  patient,
  loading,
  getName,
  getInitial,
  getId,
  getEmail,
  getPhone,
  getGender,
  getAge,
  getDOB,
  formatDate,
  getStatus,
  onClose,
}) {

  const age =
    getAge(patient);

  const latestVitals =
    patient.latest_vitals ||
    patient.vitals ||
    {};

  const visits =
    patient.visits ||
    patient.visit_history ||
    [];


  return (

    <div
      style={{
        position:
          'fixed',
        inset: 0,
        background:
          'rgba(15,25,45,0.42)',
        zIndex: 1000,
        display:
          'flex',
        justifyContent:
          'flex-end',
      }}
      onClick={onClose}
    >

      <div
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width:
            'min(680px, 92vw)',
          height:
            '100%',
          background:
            '#F8FAFD',
          overflowY:
            'auto',
          boxShadow:
            '-15px 0 50px rgba(20,40,80,0.18)',
          animation:
            'patientPanelIn 0.28s ease',
        }}
      >

        {/* =================================================
            DETAIL HEADER
        ================================================= */}

        <div
          style={{
            background:
              '#FFFFFF',
            borderBottom:
              '1px solid #E8ECF2',
            padding:
              '22px 26px',
            position:
              'sticky',
            top: 0,
            zIndex: 10,
          }}
        >

          <div
            style={{
              display:
                'flex',
              justifyContent:
                'space-between',
              alignItems:
                'flex-start',
            }}
          >

            <div
              style={{
                display:
                  'flex',
                alignItems:
                  'center',
                gap: 14,
              }}
            >

              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius:
                    '50%',
                  background:
                    'linear-gradient(135deg,#E2ECFA,#C5D6EA)',
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  color:
                    '#40516A',
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {getInitial(
                  patient
                )}
              </div>


              <div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: 21,
                    color:
                      '#273244',
                  }}
                >
                  {getName(
                    patient
                  )}
                </h2>


                <div
                  style={{
                    marginTop:
                      5,
                    fontSize:
                      11.5,
                    color:
                      '#7A8392',
                  }}
                >
                  Patient ID:{' '}
                  {getId(
                    patient
                  )}
                </div>


                <div
                  style={{
                    marginTop:
                      6,
                  }}
                >

                  <span
                    style={{
                      display:
                        'inline-flex',
                      alignItems:
                        'center',
                      gap: 5,
                      padding:
                        '4px 8px',
                      borderRadius:
                        20,
                      background:
                        'rgba(15,110,86,0.08)',
                      color:
                        '#0F6E56',
                      fontSize:
                        10,
                      fontWeight:
                        600,
                    }}
                  >

                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius:
                          '50%',
                        background:
                          '#0F6E56',
                      }}
                    />

                    {getStatus(
                      patient
                    )}

                  </span>

                </div>

              </div>

            </div>


            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                border: 'none',
                borderRadius:
                  '50%',
                background:
                  '#F1F4F8',
                color:
                  '#687386',
                cursor:
                  'pointer',
                fontSize: 19,
              }}
            >
              ×
            </button>

          </div>

        </div>


        {/* =================================================
            DETAILS BODY
        ================================================= */}

        <div
          style={{
            padding:
              '24px 26px 50px',
          }}
        >

          {loading && (

            <div
              style={{
                marginBottom:
                  18,
                padding:
                  '10px 13px',
                borderRadius:
                  8,
                background:
                  '#EEF4FF',
                color:
                  '#0758D8',
                fontSize:
                  11.5,
              }}
            >
              Loading additional patient
              information…
            </div>

          )}


          {/* =================================================
              PERSONAL INFORMATION
          ================================================= */}

          <DetailSection
            title="Personal Information"
          >

            <DetailGrid>

              <DetailItem
                label="Full Name"
                value={
                  getName(
                    patient
                  )
                }
              />

              <DetailItem
                label="Gender"
                value={
                  getGender(
                    patient
                  )
                }
              />

              <DetailItem
                label="Age"
                value={
                  age !== null
                    ? `${age} years`
                    : 'Not provided'
                }
              />

              <DetailItem
                label="Date of Birth"
                value={
                  getDOB(
                    patient
                  )
                }
              />

            </DetailGrid>

          </DetailSection>


          {/* =================================================
              CONTACT INFORMATION
          ================================================= */}

          <DetailSection
            title="Contact Information"
          >

            <DetailGrid>

              <DetailItem
                label="Email Address"
                value={
                  getEmail(
                    patient
                  )
                }
              />

              <DetailItem
                label="Phone Number"
                value={
                  getPhone(
                    patient
                  )
                }
              />

              <DetailItem
                label="Address"
                value={
                  patient.address ||
                  patient.location ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Emergency Contact"
                value={
                  patient.emergency_contact ||
                  patient.emergencyContact ||
                  'Not provided'
                }
              />

            </DetailGrid>

          </DetailSection>


          {/* =================================================
              LATEST VITALS
          ================================================= */}

          <DetailSection
            title="Latest Vitals"
          >

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(3, 1fr)',
                gap: 10,
              }}
            >

              <VitalCard
                label="Temperature"
                value={
                  latestVitals.temperature ??
                  patient.temperature
                }
                unit="°F"
              />

              <VitalCard
                label="Heart Rate"
                value={
                  latestVitals.heart_rate ??
                  latestVitals.heartRate ??
                  patient.heart_rate
                }
                unit="bpm"
              />

              <VitalCard
                label="SpO₂"
                value={
                  latestVitals.spo2 ??
                  latestVitals.sp_o2 ??
                  patient.spo2
                }
                unit="%"
              />

              <VitalCard
                label="Systolic"
                value={
                  latestVitals.systolic ??
                  patient.systolic
                }
                unit="mmHg"
              />

              <VitalCard
                label="Diastolic"
                value={
                  latestVitals.diastolic ??
                  patient.diastolic
                }
                unit="mmHg"
              />

              <VitalCard
                label="Blood Sugar"
                value={
                  latestVitals.sugar ??
                  latestVitals.blood_sugar ??
                  patient.sugar
                }
                unit="mg/dL"
              />

            </div>

          </DetailSection>


          {/* =================================================
              MEDICAL INFORMATION
          ================================================= */}

          <DetailSection
            title="Medical Information"
          >

            <DetailGrid>

              <DetailItem
                label="Blood Group"
                value={
                  patient.blood_group ||
                  patient.bloodGroup ||
                  'Not provided'
                }
              />

              <DetailItem
                label="Allergies"
                value={
                  patient.allergies ||
                  'None recorded'
                }
              />

              <DetailItem
                label="Current Medications"
                value={
                  patient.medications ||
                  patient.current_medications ||
                  'None recorded'
                }
              />

              <DetailItem
                label="Medical Conditions"
                value={
                  patient.conditions ||
                  patient.medical_conditions ||
                  'None recorded'
                }
              />

            </DetailGrid>

          </DetailSection>


          {/* =================================================
              VISIT HISTORY
          ================================================= */}

          <DetailSection
            title="Visit History"
          >

            {Array.isArray(visits) &&
            visits.length > 0 ? (

              <div
                style={{
                  display:
                    'flex',
                  flexDirection:
                    'column',
                  gap: 9,
                }}
              >

                {visits.map(
                  (visit, index) => (

                    <div
                      key={
                        visit.id ||
                        index
                      }
                      style={{
                        background:
                          '#FAFBFD',
                        border:
                          '1px solid #EDF0F4',
                        borderRadius:
                          9,
                        padding:
                          '12px 14px',
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        alignItems:
                          'center',
                      }}
                    >

                      <div>

                        <div
                          style={{
                            fontSize:
                              13,
                            fontWeight:
                              600,
                            color:
                              '#354052',
                          }}
                        >
                          {visit.title ||
                            visit.visit_type ||
                            `Visit ${index + 1}`}
                        </div>

                        <div
                          style={{
                            marginTop:
                              3,
                            fontSize:
                              11,
                            color:
                              '#7A8392',
                          }}
                        >
                          {formatDate(
                            visit.created_at ||
                            visit.date ||
                            visit.visit_date
                          )}
                        </div>

                      </div>


                      <span
                        style={{
                          fontSize:
                            10.5,
                          fontWeight:
                            600,
                          color:
                            '#0F6E56',
                          background:
                            'rgba(15,110,86,0.08)',
                          padding:
                            '5px 8px',
                          borderRadius:
                            20,
                        }}
                      >
                        {visit.status ||
                          'Completed'}
                      </span>

                    </div>

                  )
                )}

              </div>

            ) : (

              <div
                style={{
                  padding:
                    '25px',
                  textAlign:
                    'center',
                  background:
                    '#FAFBFD',
                  border:
                    '1px solid #EDF0F4',
                  borderRadius:
                    9,
                  color:
                    '#7A8392',
                  fontSize:
                    12.5,
                }}
              >
                No visit history available.
              </div>

            )}

          </DetailSection>


          {/* =================================================
              ACCOUNT INFORMATION
          ================================================= */}

          <DetailSection
            title="Account Information"
          >

            <DetailGrid>

              <DetailItem
                label="Patient ID"
                value={
                  getId(
                    patient
                  )
                }
              />

              <DetailItem
                label="Account Status"
                value={
                  getStatus(
                    patient
                  )
                }
              />

              <DetailItem
                label="Registered"
                value={
                  formatDate(
                    patient.created_at ||
                    patient.createdAt
                  )
                }
              />

              <DetailItem
                label="Last Updated"
                value={
                  formatDate(
                    patient.updated_at ||
                    patient.updatedAt
                  )
                }
              />

            </DetailGrid>

          </DetailSection>

        </div>

      </div>


      {/* =====================================================
          PANEL ANIMATION
      ===================================================== */}

      <style>
        {`
          @keyframes patientPanelIn {
            from {
              transform: translateX(100%);
              opacity: 0.5;
            }

            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>

    </div>

  );
}


/* =========================================================
   DETAIL SECTION
========================================================= */

function DetailSection({
  title,
  children,
}) {

  return (

    <section
      style={{
        marginBottom:
          22,
      }}
    >

      <h3
        style={{
          margin:
            '0 0 11px',
          fontSize:
            14.5,
          color:
            '#354052',
        }}
      >
        {title}
      </h3>

      {children}

    </section>

  );
}


/* =========================================================
   DETAIL GRID
========================================================= */

function DetailGrid({
  children,
}) {

  return (

    <div
      style={{
        display:
          'grid',
        gridTemplateColumns:
          '1fr 1fr',
        gap: 10,
      }}
    >
      {children}
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
          '13px 14px',
        background:
          '#FFFFFF',
        border:
          '1px solid #EDF0F4',
        borderRadius:
          9,
      }}
    >

      <div
        style={{
          fontSize:
            10.5,
          color:
            '#8A93A2',
          fontWeight:
            600,
          marginBottom:
            5,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize:
            12.5,
          color:
            '#354052',
          fontWeight:
            600,
          overflowWrap:
            'anywhere',
        }}
      >
        {value || 'Not provided'}
      </div>

    </div>

  );
}


/* =========================================================
   VITAL CARD
========================================================= */

function VitalCard({
  label,
  value,
  unit,
}) {

  const hasValue =
    value !== null &&
    value !== undefined &&
    value !== '';

  return (

    <div
      style={{
        padding:
          '13px 12px',
        background:
          '#FFFFFF',
        border:
          '1px solid #EDF0F4',
        borderRadius:
          9,
      }}
    >

      <div
        style={{
          color:
            '#8A93A2',
          fontSize:
            10.5,
          marginBottom:
            6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color:
            hasValue
              ? '#273244'
              : '#A0A7B2',
          fontSize:
            17,
          fontWeight:
            700,
        }}
      >
        {hasValue
          ? `${value} ${unit}`
          : '—'}
      </div>

    </div>

  );
}