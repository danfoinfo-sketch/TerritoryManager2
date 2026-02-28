import React, { useState, useRef, useEffect } from 'react';
import { Save, FolderOpen, Plus, Trash2, MapPin, Eye, EyeOff, Sun, Moon, Pencil } from 'lucide-react';

export default function Sidebar({
  territories,
  activeTerritoryId,
  addModeTerritoryId,
  onSelectTerritory,
  onAddTerritory,
  onDeleteTerritory,
  onUpdateTerritory,
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
  theme = 'dark',
  onThemeChange,
}) {
  const [editingTerritoryId, setEditingTerritoryId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editingTerritoryId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTerritoryId]);
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
    <div className={`sidebar ${theme === 'light' ? 'sidebar--light' : ''}`}>
      <div className="sidebar__inner">
        <h2 className="sidebar__title">Territory Manager</h2>

        {/* Profile Management Section */}
        <div className="sidebar__card">
          <h3 className="sidebar__card-title">Profiles</h3>
          <div className="sidebar__btn-row">
            <button
              type="button"
              className="sidebar__btn sidebar__btn--primary"
              onClick={() => {
                console.log('Save Profile As clicked');
                onSaveProfile();
              }}
              disabled={savingProfile || loadingProfiles}
              aria-label="Save profile as"
            >
              <Save size={16} aria-hidden />
              {savingProfile ? 'Saving...' : 'Save Profile As…'}
            </button>
            <button
              type="button"
              className="sidebar__btn sidebar__btn--secondary"
              onClick={() => setShowLoadProfile(!showLoadProfile)}
              disabled={loadingProfiles || loadingProfile}
              aria-label="Load profile"
            >
              <FolderOpen size={16} aria-hidden />
              {loadingProfiles ? 'Loading...' : 'Load Profile'}
            </button>
          </div>
          {showLoadProfile && (
            <div style={{ marginTop: '8px' }}>
              {loadingProfiles ? (
                <p className="sidebar__empty">Loading profiles...</p>
              ) : savedProfiles.length === 0 ? (
                <p className="sidebar__empty">No saved profiles yet</p>
              ) : (
                <select
                  className="sidebar__select"
                  onChange={(e) => {
                    if (e.target.value && !loadingProfile) {
                      onLoadProfile(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  disabled={loadingProfile}
                  aria-label="Choose a profile"
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

        <div className="sidebar__section">
          <button
            type="button"
            className="sidebar__btn sidebar__btn--green"
            onClick={onAddTerritory}
            aria-label="Create new territory"
          >
            <Plus size={18} aria-hidden />
            Create New Territory
          </button>
        </div>

        <h3 className="sidebar__section-title">Territories ({territories.length})</h3>

        {territories.length === 0 ? (
          <p className="sidebar__empty">
            No territories yet. Create one and click "Add ZIPs" to start!
          </p>
        ) : (
          <ul className="sidebar__territory-list">
            {territories.map((territory) => {
              const pop = territory.zips.reduce((sum, z) => sum + (z.pop || 0), 0);
              const homes = territory.zips.reduce((sum, z) => sum + (z.standAloneHouses || 0), 0);
              const isActive = activeTerritoryId === territory.id;
              const isAddMode = addModeTerritoryId === territory.id;

              return (
                <li key={territory.id} className="sidebar__territory-item">
                  <div
                    className={`sidebar__territory-card ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      if (e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('input')) {
                        return;
                      }
                      console.log('DEBUG: Territory clicked:', territory.name, 'id:', territory.id);
                      setActiveTerritoryId(territory.id);
                      console.log('DEBUG: Calling zoomToTerritory for', territory.id);
                      zoomToTerritory(territory.id);
                    }}
                  >
                    <div className="sidebar__territory-header">
                      <span className="sidebar__territory-name">
                        <span
                          className="sidebar__territory-dot"
                          style={{ backgroundColor: territory.color }}
                          aria-hidden
                        />
                        {editingTerritoryId === territory.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            className="sidebar__territory-name-input"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = editingName.trim();
                                if (trimmed && onUpdateTerritory) {
                                  onUpdateTerritory(territory.id, trimmed, territory.color, territory.zips);
                                }
                                setEditingTerritoryId(null);
                              } else if (e.key === 'Escape') {
                                setEditingTerritoryId(null);
                                setEditingName('');
                              }
                            }}
                            onBlur={() => {
                              const trimmed = editingName.trim();
                              if (trimmed && onUpdateTerritory) {
                                onUpdateTerritory(territory.id, trimmed, territory.color, territory.zips);
                              }
                              setEditingTerritoryId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Edit territory name"
                          />
                        ) : (
                          territory.name
                        )}
                      </span>
                      <span className="sidebar__territory-header-actions">
                        {onUpdateTerritory && editingTerritoryId !== territory.id && (
                          <button
                            type="button"
                            className="sidebar__territory-rename"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTerritoryId(territory.id);
                              setEditingName(territory.name);
                            }}
                            aria-label={`Rename ${territory.name}`}
                            title="Rename territory"
                          >
                            <Pencil size={14} aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          className="sidebar__territory-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTerritory(territory.id);
                          }}
                          aria-label={`Delete ${territory.name}`}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </span>
                    </div>
                    <div className="sidebar__territory-stats">
                      <span className="sidebar__territory-badge">
                        Pop: {pop.toLocaleString()}
                      </span>
                      <span className="sidebar__territory-badge">
                        Homes: {homes.toLocaleString()}
                      </span>
                      <span className="sidebar__territory-badge">
                        Zips: {territory.zips.length}
                      </span>
                    </div>
                    <div className="sidebar__territory-actions">
                      <button
                        type="button"
                        className={`sidebar__btn sidebar__btn--sm sidebar__btn--green-sm ${isAddMode ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔥 Add/Save button clicked for territory', territory.id, 'current addModeTerritoryId:', addModeTerritoryId);
                          if (addModeTerritoryId === territory.id) {
                            console.log('🔥 Exiting add mode for territory', territory.id);
                            setAddModeTerritoryId(null);
                          } else {
                            console.log('🔥 Entering add mode for territory', territory.id);
                            setAddModeTerritoryId(territory.id);
                          }
                        }}
                        aria-label={isAddMode ? 'Save territory' : 'Add ZIPs to territory'}
                      >
                        <MapPin size={14} aria-hidden />
                        {isAddMode ? 'Save Territory' : 'Add ZIPs'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="sidebar__bottom">
          <button
            type="button"
            className={`sidebar__btn sidebar__btn--outline ${showBoundaries ? 'active' : ''}`}
            onClick={() => setShowBoundaries(!showBoundaries)}
            aria-label={showBoundaries ? 'Hide boundaries' : 'Show boundaries'}
          >
            {showBoundaries ? (
              <>
                <Eye size={18} aria-hidden />
                Hide Boundaries
              </>
            ) : (
              <>
                <EyeOff size={18} aria-hidden />
                Show Boundaries
              </>
            )}
          </button>
        </div>
      </div>

      {onThemeChange && (
        <div className="sidebar__theme-corner">
          <button
            type="button"
            className="sidebar__theme-btn"
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <Sun size={22} aria-hidden />
            ) : (
              <Moon size={22} aria-hidden />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
