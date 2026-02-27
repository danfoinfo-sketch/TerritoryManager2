import { useState, useCallback, useEffect } from 'react';
import { collection, setDoc, getDocs, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export function useProfiles(territories) {
  // Profile management state
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [showLoadProfile, setShowLoadProfile] = useState(false);
  const [showSaveProfileModal, setShowSaveProfileModal] = useState(false);
  const [saveProfileName, setSaveProfileName] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Load saved profiles from Firestore
  const loadSavedProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'profiles'));
      const profileNames = querySnapshot.docs.map(doc => doc.data().name);
      setSavedProfiles(profileNames);
    } catch (error) {
      console.error('Error loading saved profiles:', error);
      setSavedProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  // Save profile to Firestore
  const saveProfile = useCallback(async () => {
    console.log('saveProfile function called with name:', saveProfileName);
    const trimmedName = saveProfileName.trim();

    if (!trimmedName) {
      console.log('No profile name entered, returning');
      return;
    }

    setSavingProfile(true);

    try {
      // Create document ID from profile name (lowercase, replace spaces with hyphens)
      const docId = trimmedName.toLowerCase().replace(/\s+/g, '-');

      // Check if profile already exists
      const profileRef = doc(db, 'profiles', docId);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        if (!window.confirm(`Profile "${trimmedName}" already exists. Overwrite it?`)) {
          setSavingProfile(false);
          return;
        }
      }

      console.log('Saving territories to Firestore:', territories);

      // Save profile to Firestore
      await setDoc(profileRef, {
        name: trimmedName,
        territories: territories,
        createdAt: serverTimestamp()
      });

      // Reload profiles list
      await loadSavedProfiles();

      console.log(`Profile "${trimmedName}" saved successfully!`);
      alert(`Profile saved: ${trimmedName}`);
      setShowSaveProfileModal(false);
      setSaveProfileName('');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }, [saveProfileName, loadSavedProfiles]);

  // Load profile from Firestore
  const loadProfile = useCallback(async (profileName, currentTerritories) => {
    if (!profileName) return;

    setLoadingProfile(true);

    try {
      // Convert profile name to document ID format
      const docId = profileName.toLowerCase().replace(/\s+/g, '-');
      const profileRef = doc(db, 'profiles', docId);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        alert(`Profile "${profileName}" not found.`);
        return;
      }

      const profileData = profileSnap.data();

      // Warn if there are current territories
      if (currentTerritories && currentTerritories.length > 0) {
        if (!confirm(`This will replace your current ${currentTerritories.length} territories with the saved profile. Continue?`)) {
          setLoadingProfile(false);
          return;
        }
      }

      // Return the loaded territories (let parent component handle state update)
      return profileData.territories;

    } catch (error) {
      console.error('Error loading profile:', error);
      alert('Error loading profile. Please try again.');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  // Open save profile modal
  const openSaveProfileModal = useCallback(() => {
    console.log('Opening save profile modal');
    setSaveProfileName('');
    setShowSaveProfileModal(true);
  }, []);

  // Load saved profiles on mount
  useEffect(() => {
    loadSavedProfiles();
  }, [loadSavedProfiles]);

  return {
    // State
    savedProfiles,
    showLoadProfile,
    showSaveProfileModal,
    saveProfileName,
    loadingProfiles,
    savingProfile,
    loadingProfile,

    // Actions
    saveProfile,
    loadProfile,
    loadSavedProfiles,
    openSaveProfileModal,

    // State setters
    setShowLoadProfile,
    setShowSaveProfileModal,
    setSaveProfileName
  };
}