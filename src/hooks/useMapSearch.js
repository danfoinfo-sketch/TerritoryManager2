import { useState, useCallback, useRef } from 'react';

export function useMapSearch(mapContainerRef) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounce ref for search
  const searchTimeoutRef = useRef(null);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || searchLoading) return;

    setSearchLoading(true);
    try {
      if (mapContainerRef.current) {
        const result = await mapContainerRef.current.geocodeAndZoom(searchQuery.trim());
        if (!result) {
          alert(`No location found for "${searchQuery}". Try a different search term.`);
        } else {
          console.log('Search completed successfully:', result.placeName);
          // Clear input after successful search
          setSearchQuery('');
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, searchLoading, mapContainerRef]);

  // Debounced search handler for input changes (300ms delay)
  const handleSearchInput = useCallback((value) => {
    setSearchQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only set timeout if there's actual input
    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch();
      }, 300);
    }
  }, [handleSearch]);

  return {
    searchQuery,
    searchLoading,
    handleSearch,
    handleSearchInput,
    setSearchQuery
  };
}