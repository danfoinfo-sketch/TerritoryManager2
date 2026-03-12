import React, { useState, useRef, useEffect } from 'react';
import { Save, FolderOpen, Plus, Trash2, MapPin, Eye, EyeOff, Sun, Moon, Pencil, Edit3, X, FilePlus, Download } from 'lucide-react';

export default function Sidebar({
  territories,
  activeTerritoryId,
  addModeTerritoryId,
  onSelectTerritory,
  onAddTerritory,
  onDeleteTerritory,
  onUpdateTerritory,
  onClearTerritories,
  showBoundaries,
  setShowBoundaries,
  setAddModeTerritoryId,
  setActiveTerritoryId,
  zoomToTerritory,
  savedProfiles,
  onSaveProfile,
  onLoadProfile,
  onDeleteProfile,
  onRenameProfile,
  currentProfileName,
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
  const [editingProfileName, setEditingProfileName] = useState(null);
  const [editingProfileNewName, setEditingProfileNewName] = useState('');
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [exportMode, setExportMode] = useState(false);
  const [selectedTerritoriesForExport, setSelectedTerritoriesForExport] = useState(new Set());
  const editInputRef = useRef(null);
  const editProfileInputRef = useRef(null);

  useEffect(() => {
    if (editingTerritoryId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTerritoryId]);

  useEffect(() => {
    if (editingProfileName && editProfileInputRef.current) {
      editProfileInputRef.current.focus();
      editProfileInputRef.current.select();
    }
  }, [editingProfileName]);
  // Debug: log territories received by sidebar
  React.useEffect(() => {
    console.log('📋 Sidebar received territories:', territories.map(t => ({ id: t.id, name: t.name, zips: t.zips.length })));
  }, [territories]);

  // Generate and download CSV export
  const handleExport = () => {
    console.log('🚀 Starting CSV export...');
    console.log('📊 Selected territories:', selectedTerritoriesForExport.size);

    if (selectedTerritoriesForExport.size === 0) {
      console.log('❌ No territories selected, aborting export');
      return;
    }

    const csvData = [];
    // Add header
    csvData.push(['Profile', 'Territory Title', 'Population', 'Homes', 'ZIP Count', 'ZIP Codes']);
    console.log('📝 Added CSV header');

    // Add data for each selected territory
    selectedTerritoriesForExport.forEach(territoryId => {
      const territory = territories.find(t => t.id === territoryId);
      if (territory) {
        const pop = territory.zips.reduce((sum, z) => sum + (z.pop || 0), 0);
        const homes = territory.zips.reduce((sum, z) => sum + (z.standAloneHouses || 0), 0);
        const zipCodes = territory.zips.map(z => z.zip).join(',');
        console.log(`📍 Territory "${territory.name}": ${territory.zips.length} ZIPs -> "${zipCodes}"`);
        console.log('🔍 ZIP codes array:', territory.zips.map(z => z.zip));
        console.log('🔍 Join separator test:', ['a','b','c'].join(','));

        csvData.push([
          currentProfileName,
          territory.name,
          pop.toString(),
          homes.toString(),
          territory.zips.length.toString(),
          zipCodes
        ]);
      }
    });

    // Convert to CSV string
    const csvContent = csvData.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    console.log('📄 Generated CSV content preview:', csvContent.substring(0, 200) + '...');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentProfileName.replace(/[^a-z0-9]/gi, '_')}_territories.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV export completed and file downloaded');

    // Exit export mode
    setExportMode(false);
    setSelectedTerritoriesForExport(new Set());
  };

  // Handle sidebar clicks for deselection
  React.useEffect(() => {
    const handleSidebarClick = (e) => {
      // Check if click is on interactive elements that should not trigger deselection
      const interactiveElements = [
        'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'
      ];

      const interactiveClasses = [
        'sidebar__territory-card',
        'sidebar__profile-item',
        'sidebar__btn'
      ];

      const isInteractive = interactiveElements.includes(e.target.tagName) ||
                           interactiveClasses.some(cls => e.target.closest(`.${cls}`));

      // If clicking on empty space (not interactive elements), deselect territory
      if (!isInteractive) {
        console.log('📱 Empty sidebar space clicked - deselecting territory');
        if (setActiveTerritoryId) {
          setActiveTerritoryId(null);
        }
        if (setAddModeTerritoryId) {
          setAddModeTerritoryId(null);
        }
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
              className="sidebar__btn sidebar__btn--secondary"
              onClick={() => {
                if (onClearTerritories) {
                  onClearTerritories();
                }
                setShowLoadProfile(false);
              }}
              disabled={loadingProfiles || loadingProfile}
              aria-label="Start new profile"
            >
              <FilePlus size={16} aria-hidden />
              New Profile
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
          </div>
          {showLoadProfile && (
            <div style={{ marginTop: '8px' }}>
              {loadingProfiles ? (
                <p className="sidebar__empty">Loading profiles...</p>
              ) : savedProfiles.length === 0 ? (
                <p className="sidebar__empty">No saved profiles yet</p>
              ) : (
                <div className="sidebar__profile-list">
                  {savedProfiles.map(profileName => (
                    <div key={profileName} className="sidebar__profile-item">
                      {editingProfileName === profileName ? (
                        <div className="sidebar__profile-edit">
                          <input
                            ref={editProfileInputRef}
                            type="text"
                            className="sidebar__profile-name-input"
                            value={editingProfileNewName}
                            onChange={(e) => setEditingProfileNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = editingProfileNewName.trim();
                                if (trimmed && onRenameProfile) {
                                  onRenameProfile(profileName, trimmed);
                                }
                                setEditingProfileName(null);
                                setEditingProfileNewName('');
                              } else if (e.key === 'Escape') {
                                setEditingProfileName(null);
                                setEditingProfileNewName('');
                              }
                            }}
                            onBlur={() => {
                              const trimmed = editingProfileNewName.trim();
                              if (trimmed && onRenameProfile) {
                                onRenameProfile(profileName, trimmed);
                              }
                              setEditingProfileName(null);
                              setEditingProfileNewName('');
                            }}
                            disabled={loadingProfile}
                            aria-label={`Rename ${profileName}`}
                          />
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="sidebar__profile-name"
                            onClick={() => {
                              if (!loadingProfile) {
                                onLoadProfile(profileName);
                              }
                            }}
                            disabled={loadingProfile}
                            title={`Load profile: ${profileName}`}
                          >
                            {profileName}
                          </button>
                          <div className="sidebar__profile-actions">
                            <button
                              type="button"
                              className="sidebar__profile-rename"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProfileName(profileName);
                                setEditingProfileNewName(profileName);
                              }}
                              disabled={loadingProfile}
                              aria-label={`Rename ${profileName}`}
                              title="Rename profile"
                            >
                              <Edit3 size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="sidebar__profile-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProfileToDelete(profileName);
                              }}
                              disabled={loadingProfile}
                              aria-label={`Delete ${profileName}`}
                              title="Delete profile"
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Profile Confirmation Modal */}
        {profileToDelete && (
          <div className="sidebar__delete-modal-overlay">
            <div className="sidebar__delete-modal">
              <h3 className="sidebar__delete-modal-title">Delete Profile</h3>
              <p className="sidebar__delete-modal-text">
                Are you sure you want to delete the profile "{profileToDelete}"?
                This action cannot be undone.
              </p>
              <div className="sidebar__delete-modal-actions">
                <button
                  type="button"
                  className="sidebar__btn sidebar__btn--secondary"
                  onClick={() => setProfileToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sidebar__btn sidebar__btn--delete"
                  onClick={() => {
                    if (onDeleteProfile) {
                      onDeleteProfile(profileToDelete);
                    }
                    setProfileToDelete(null);
                  }}
                >
                  Delete Profile
                </button>
              </div>
            </div>
          </div>
        )}

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

        <div className="sidebar__current-profile">
          <span className="sidebar__current-profile-label">Current Profile:</span>
          <span className="sidebar__current-profile-name">{currentProfileName}</span>
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
                      if (e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('input') || exportMode) {
                        return;
                      }
                      console.log('DEBUG: Territory clicked:', territory.name, 'id:', territory.id);
                      setActiveTerritoryId(territory.id);
                      console.log('DEBUG: Calling zoomToTerritory for', territory.id);
                      zoomToTerritory(territory.id);
                    }}
                  >
                    <div className="sidebar__territory-header">
                      {exportMode && (
                        <input
                          type="checkbox"
                          className="sidebar__territory-checkbox"
                          checked={selectedTerritoriesForExport.has(territory.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newSelected = new Set(selectedTerritoriesForExport);
                            if (e.target.checked) {
                              newSelected.add(territory.id);
                            } else {
                              newSelected.delete(territory.id);
                            }
                            setSelectedTerritoriesForExport(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
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
                            <Pencil size={12} aria-hidden />
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
                          <Trash2 size={14} aria-hidden />
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
          {exportMode ? (
            <>
              <button
                type="button"
                className="sidebar__btn sidebar__btn--outline"
                onClick={() => {
                  setExportMode(false);
                  setSelectedTerritoriesForExport(new Set());
                }}
              >
                Cancel Export
              </button>
              <button
                type="button"
                className="sidebar__btn sidebar__btn--primary"
                onClick={handleExport}
                disabled={selectedTerritoriesForExport.size === 0}
              >
                <Download size={16} aria-hidden />
                Export ({selectedTerritoriesForExport.size})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`sidebar__btn sidebar__btn--outline ${showBoundaries ? 'active' : ''}`}
                onClick={() => setShowBoundaries(!showBoundaries)}
                aria-label={showBoundaries ? 'Hide boundaries' : 'Show boundaries'}
              >
                {showBoundaries ? (
                  <Eye size={18} aria-hidden />
                ) : (
                  <EyeOff size={18} aria-hidden />
                )}
                Boundaries
              </button>

              <button
                type="button"
                className="sidebar__btn sidebar__btn--outline"
                onClick={() => setExportMode(true)}
                title="Export territories to CSV"
              >
                <Download size={18} aria-hidden />
                Export
              </button>

              {onThemeChange && (
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
