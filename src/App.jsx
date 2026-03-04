import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import MapboxMapContainer from './components/map/MapboxMapContainer';
import Sidebar from './components/Sidebar';
import { useMapSearch } from './hooks/useMapSearch';
import { useProfiles } from './hooks/useProfiles';
import { useTerritories } from './hooks/useTerritories';
import './App.css';

function App() {
  // Refs (must be declared before hooks that use them)
  const mapContainerRef = useRef(null);

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
    clearTerritories,
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
    deleteProfile,
    renameProfile,
    openSaveProfileModal,
    setShowLoadProfile,
    setShowSaveProfileModal,
    setSaveProfileName
  } = useProfiles(territories);

  // Search functionality (extracted to hook)
  const { searchQuery, searchLoading, handleSearch, setSearchQuery } = useMapSearch(mapContainerRef);


  const [showBoundaries, setShowBoundaries] = useState(true);
  const [pendingZoomId, setPendingZoomId] = useState(null);
  const [sidebarTheme, setSidebarTheme] = useState(() => {
    try {
      return (localStorage.getItem('sidebarTheme') || 'dark');
    } catch {
      return 'dark';
    }
  });

  const [currentProfileName, setCurrentProfileName] = useState('New');

  useEffect(() => {
    try {
      localStorage.setItem('sidebarTheme', sidebarTheme);
    } catch (_) {}
  }, [sidebarTheme]);


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
      setCurrentProfileName(profileName);
      setShowLoadProfile(false);
    }
  }, [loadProfileFromFirestore, territories]);

  const handleClearTerritories = useCallback(() => {
    clearTerritories();
    setCurrentProfileName('New');
  }, [clearTerritories]);

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
        <div className="search-bar">
          <input
            type="text"
            className="search-bar__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ZIP, city, state."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            disabled={searchLoading}
            aria-label="Search ZIP, city, state"
          />
          <button
            type="button"
            className="search-bar__btn search-bar__btn--primary"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || searchLoading}
            aria-label="Search"
          >
            {searchLoading ? (
              <Loader2 size={20} className="spin" aria-hidden />
            ) : (
              <Search size={20} aria-hidden />
            )}
          </button>
        </div>
      </div>

      <Sidebar
        className="sidebar"
        style={{ width: 300, height: '100vh', zIndex: 1000, background: 'white', overflowY: 'auto', boxShadow: '2px 0 5px rgba(0,0,0,0.1)', flexShrink: 0 }}
        theme={sidebarTheme}
        onThemeChange={setSidebarTheme}
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
        onClearTerritories={handleClearTerritories}
        zoomToTerritory={handleSelectTerritory}
        showBoundaries={showBoundaries}
        setShowBoundaries={setShowBoundaries}
        getTerritoryStats={getTerritoryStats}
        savedProfiles={savedProfiles}
        onSaveProfile={openSaveProfileModal}
        onLoadProfile={loadProfile}
        onDeleteProfile={deleteProfile}
        onRenameProfile={renameProfile}
        currentProfileName={currentProfileName}
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
          setAddModeTerritoryId={setAddModeTerritoryId}
          addZipToActiveTerritory={addZipToActiveTerritory}
          showBoundaries={showBoundaries}
        />
      </div>

      {/* Save Profile Modal */}
      {showSaveProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Save Territory Profile</h3>
            <div style={{ marginBottom: '16px' }}>
              <label className="modal-label">Profile Name:</label>
              <input
                type="text"
                className="modal-input"
                value={saveProfileName}
                onChange={(e) => setSaveProfileName(e.target.value)}
                placeholder="Enter profile name..."
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
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn--secondary"
                onClick={() => setShowSaveProfileModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn modal-btn--primary"
                onClick={saveProfile}
                disabled={!saveProfileName.trim() || savingProfile}
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