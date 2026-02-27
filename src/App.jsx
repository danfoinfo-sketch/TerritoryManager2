import React, { useState, useEffect, useRef, useCallback } from 'react';
import MapboxMapContainer from './components/map/MapboxMapContainer';
import Sidebar from './components/Sidebar';
import { useMapSearch } from './hooks/useMapSearch';
import { useProfiles } from './hooks/useProfiles';
import { useTerritories } from './hooks/useTerritories';

// Add CSS animation for loading spinner
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject the CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinnerStyle;
  document.head.appendChild(style);
}

function App() {
  // Territory management (extracted to hook)
  const {
    territories,
    activeTerritoryId,
    addModeTerritoryId,
    createNewTerritory,
    handleUpdateTerritory,
    handleDeleteTerritory,
    handleSelectTerritory,
    handleSetAddModeTerritoryId,
    handleToggleTerritoryVisibility,
    addZipToActiveTerritory,
    getTerritoryStats,
    setTerritories,
    setActiveTerritoryId,
    setAddModeTerritoryId
  } = useTerritories(mapContainerRef);

  // Profile management (extracted to hook)
  const {
    savedProfiles,
    showLoadProfile,
    showSaveProfileModal,
    saveProfileName,
    loadingProfiles,
    savingProfile,
    loadingProfile,
    saveProfile: saveProfileToFirestore,
    loadProfile: loadProfileFromFirestore,
    openSaveProfileModal,
    setShowLoadProfile,
    setShowSaveProfileModal,
    setSaveProfileName
  } = useProfiles(territories);

  // Search functionality (extracted to hook)
  const { searchQuery, searchLoading, handleSearch, setSearchQuery } = useMapSearch(mapContainerRef);


  const [showBoundaries, setShowBoundaries] = useState(true);
  const [pendingZoomId, setPendingZoomId] = useState(null);
  const mapContainerRef = useRef(null);


  // Profile management functions (wrapped to work with hook)
  const saveProfile = useCallback(async () => {
    await saveProfileToFirestore();
  }, [saveProfileToFirestore]);

  const loadProfile = useCallback(async (profileName) => {
    const loadedTerritories = await loadProfileFromFirestore(profileName, territories);
    if (loadedTerritories) {
      setTerritories(loadedTerritories);
      setActiveTerritoryId(null);
      setAddModeTerritoryId(null);
      setShowLoadProfile(false);
    }
  }, [loadProfileFromFirestore, territories]);

  useEffect(() => {
    console.log('Sidebar element exists?', document.querySelector('.sidebar'));
    console.log('Sidebar width:', document.querySelector('.sidebar')?.offsetWidth);
  }, []);

  return (
    <div className="app-container" style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      {/* Search Bar Overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: '350px',
        maxWidth: '90vw',
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          background: 'white',
          borderRadius: '8px',
          padding: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb',
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ZIP, city, state..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              padding: '4px 8px',
              background: 'transparent',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            disabled={searchLoading}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || searchLoading}
            style={{
              padding: '8px',
              background: searchQuery.trim() && !searchLoading ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: searchQuery.trim() && !searchLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
            }}
          >
            {searchLoading ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            ) : (
              '🔍'
            )}
          </button>
        </div>
      </div>

      <Sidebar
        className="sidebar"
        style={{ width: 300, height: '100vh', zIndex: 1000, background: 'white', overflowY: 'auto', boxShadow: '2px 0 5px rgba(0,0,0,0.1)', flexShrink: 0 }}
        territories={territories}
        activeTerritoryId={activeTerritoryId}
        addModeTerritoryId={addModeTerritoryId}
        setActiveTerritoryId={setActiveTerritoryId}
        setAddModeTerritoryId={handleSetAddModeTerritoryId}
        onAddTerritory={createNewTerritory}
        onUpdateTerritory={handleUpdateTerritory}
        onDeleteTerritory={handleDeleteTerritory}
        onToggleTerritoryVisibility={handleToggleTerritoryVisibility}
        onAddZipToTerritory={addZipToActiveTerritory}
        zoomToTerritory={handleSelectTerritory}
        showBoundaries={showBoundaries}
        setShowBoundaries={setShowBoundaries}
        getTerritoryStats={getTerritoryStats}
        savedProfiles={savedProfiles}
        onSaveProfile={openSaveProfileModal}
        onLoadProfile={loadProfile}
        showLoadProfile={showLoadProfile}
        setShowLoadProfile={setShowLoadProfile}
        loadingProfiles={loadingProfiles}
        savingProfile={savingProfile}
        loadingProfile={loadingProfile}
      />
      <div className="map-wrapper" style={{ flex: 1, height: '100%', position: 'relative' }}>
        <MapboxMapContainer
          ref={mapContainerRef}
          territories={territories}
          activeTerritoryId={activeTerritoryId}
          setActiveTerritoryId={setActiveTerritoryId}
          addModeTerritoryId={addModeTerritoryId}
          addZipToActiveTerritory={addZipToActiveTerritory}
          showBoundaries={showBoundaries}
        />
      </div>

      {/* Save Profile Modal */}
      {showSaveProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            minWidth: '300px',
            maxWidth: '400px',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Save Territory Profile</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Profile Name:
              </label>
              <input
                type="text"
                value={saveProfileName}
                onChange={(e) => setSaveProfileName(e.target.value)}
                placeholder="Enter profile name..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveProfile();
                  } else if (e.key === 'Escape') {
                    setShowSaveProfileModal(false);
                  }
                }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveProfileModal(false)}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={!saveProfileName.trim() || savingProfile}
                style={{
                  padding: '8px 16px',
                  background: (!saveProfileName.trim() || savingProfile) ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (!saveProfileName.trim() || savingProfile) ? 'not-allowed' : 'pointer',
                }}
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;