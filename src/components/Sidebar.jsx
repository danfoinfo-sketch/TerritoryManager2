import React from 'react';

export default function Sidebar({
  territories,
  activeTerritoryId,
  addModeTerritoryId,
  onSelectTerritory,
  onAddTerritory,
  onDeleteTerritory,
  showBoundaries,
  setShowBoundaries,
  setAddModeTerritoryId,
  setActiveTerritoryId,
  zoomToTerritory,
  savedProfiles,
  onSaveProfile,
  onLoadProfile,
  showLoadProfile,
  setShowLoadProfile,
  loadingProfiles,
  savingProfile,
  loadingProfile,
}) {
  console.log('Sidebar received profile props:', { savedProfiles, onSaveProfile, showLoadProfile });
  // Debug: log territories received by sidebar
  React.useEffect(() => {
    console.log('📋 Sidebar received territories:', territories.map(t => ({ id: t.id, name: t.name, zips: t.zips.length })));
  }, [territories]);

  // Debug: Add global click listener to sidebar
  React.useEffect(() => {
    const handleSidebarClick = (e) => {
      console.log('📱 Sidebar click detected at:', e.target.tagName, e.target.className);
      if (e.target.tagName === 'BUTTON') {
        console.log('📱 Button clicked:', e.target.textContent);
      }
    };

    const sidebarElement = document.querySelector('.sidebar');
    if (sidebarElement) {
      sidebarElement.addEventListener('click', handleSidebarClick, true);
      console.log('📱 Sidebar click listener added');
    }

    return () => {
      if (sidebarElement) {
        sidebarElement.removeEventListener('click', handleSidebarClick, true);
      }
    };
  }, []);
  return (
    <div className="sidebar" style={{ width: 300, position: 'absolute', left: 0, top: 0, height: '100vh', zIndex: 1000, background: 'white', overflowY: 'auto', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Territory Manager (ZIPs Only)
      </h2>

      {/* Profile Management Section */}
      <div style={{ marginBottom: '1.5rem', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#374151' }}>
          Profiles
        </h3>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            type="button"
            onClick={() => {
              console.log('Save Profile As clicked');
              onSaveProfile();
            }}
            disabled={savingProfile || loadingProfiles}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: savingProfile || loadingProfiles ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: '500',
              cursor: savingProfile || loadingProfiles ? 'not-allowed' : 'pointer',
              zIndex: 1001,
            }}
          >
            {savingProfile ? 'Saving...' : 'Save Profile As…'}
          </button>

          <button
            type="button"
            onClick={() => setShowLoadProfile(!showLoadProfile)}
            disabled={loadingProfiles || loadingProfile}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: loadingProfiles || loadingProfile ? '#9ca3af' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: '500',
              cursor: loadingProfiles || loadingProfile ? 'not-allowed' : 'pointer',
              zIndex: 1001,
            }}
          >
            {loadingProfiles ? 'Loading...' : 'Load Profile'}
          </button>
        </div>

        {showLoadProfile && (
          <div style={{ marginTop: '8px' }}>
            {loadingProfiles ? (
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
                Loading profiles...
              </p>
            ) : savedProfiles.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
                No saved profiles yet
              </p>
            ) : (
              <select
                onChange={(e) => {
                  if (e.target.value && !loadingProfile) {
                    onLoadProfile(e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={loadingProfile}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  background: loadingProfile ? '#f9fafb' : 'white',
                  fontSize: '0.8rem',
                  cursor: loadingProfile ? 'not-allowed' : 'default',
                }}
              >
                <option value="">
                  {loadingProfile ? 'Loading profile...' : 'Choose a profile...'}
                </option>
                {savedProfiles.map(profileName => (
                  <option key={profileName} value={profileName}>
                    {profileName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAddTerritory}
        style={{
          width: '100%',
          padding: '12px',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: '600',
          marginBottom: '1rem',
          cursor: 'pointer',
        }}
      >
        Create New Territory
      </button>


      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem' }}>
        Territories ({territories.length})
      </h3>

      {territories.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          No territories yet. Create one and click "Add ZIPs" to start!
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
                    {territories.map((territory) => {

            return (
              <li
                key={territory.id}
                style={{
                  padding: '10px',
                  background: activeTerritoryId === territory.id ? '#dbeafe' : '#f1f5f9',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  border: activeTerritoryId === territory.id ? '2px solid #3b82f6' : 'none',
                }}
                                                onClick={(e) => {
                  // Don't trigger territory selection if clicking on a button
                  if (e.target.tagName === 'BUTTON') {
                    console.log('DEBUG: Button clicked, not selecting territory');
                    return;
                  }
                  console.log('DEBUG: Territory clicked:', territory.name, 'id:', territory.id);
                  setActiveTerritoryId(territory.id);
                  console.log('DEBUG: Calling zoomToTerritory for', territory.id);
                  zoomToTerritory(territory.id);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: territory.color, fontSize: '1.2rem' }}>●</span>
                    <span style={{ fontWeight: activeTerritoryId === territory.id ? 'bold' : 'normal' }}>
                      {territory.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTerritory(territory.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Delete
                  </button>
                </div>

                                <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#4b5563' }}>
                  <div>Pop: {territory.zips.reduce((sum, z) => sum + z.pop, 0).toLocaleString()}</div>
                  <div>Homes: {territory.zips.reduce((sum, z) => sum + z.standAloneHouses, 0).toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
                    ZIPs: {territory.zips.length}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔥 Add/Save button clicked for territory', territory.id, 'current addModeTerritoryId:', addModeTerritoryId);

                      if (addModeTerritoryId === territory.id) {
                        // Currently in add mode for this territory - exit add mode
                        console.log('🔥 Exiting add mode for territory', territory.id);
                        setAddModeTerritoryId(null);
                      } else {
                        // Enter add mode for this territory (or switch to this territory if in add mode for another)
                        console.log('🔥 Entering add mode for territory', territory.id);
                        setAddModeTerritoryId(territory.id);
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      background: addModeTerritoryId === territory.id ? '#10b981' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 10,
                      display: 'inline-block',
                      userSelect: 'none',
                    }}
                  >
                    {addModeTerritoryId === territory.id ? 'Save Territory' : 'Add ZIPs'}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={() => setShowBoundaries(!showBoundaries)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: showBoundaries ? '#10b981' : '#6b7280',
            color: 'white',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {showBoundaries ? '🗺️ Hide Boundaries' : '🗺️ Show Boundaries'}
        </button>
      </div>
    </div>
  );
}