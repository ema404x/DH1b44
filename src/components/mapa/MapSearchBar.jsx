import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Filter, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function MapSearchBar({
  locations = [],
  onSearch,
  onLocationSelect,
  filters = {},
  onFiltersChange,
  availableFilters = []
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    const filtered = locations.filter(loc =>
      loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setSuggestions(filtered.slice(0, 8));
    setShowSuggestions(true);
  }, [searchTerm, locations]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = (location) => {
    setSearchTerm(location.name);
    setShowSuggestions(false);
    onLocationSelect(location);
    onSearch(location.name);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
    onSearch('');
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="relative z-20">
      <div className="flex gap-2">
        {/* Search Bar */}
        <div className="flex-1 relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar ubicación, dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-9 pr-9 h-10 text-sm"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
            >
              {suggestions.map(location => (
                <button
                  key={location.id}
                  onClick={() => handleSelectLocation(location)}
                  className="w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0 flex items-start gap-3"
                >
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{location.name}</p>
                    {location.address && (
                      <p className="text-xs text-muted-foreground truncate">{location.address}</p>
                    )}
                  </div>
                  {!location.is_active && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">Inactivo</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Button */}
        {availableFilters.length > 0 && (
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute top-0 right-0 h-5 w-5 bg-primary text-primary-foreground text-xs flex items-center justify-center rounded-full font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Filter Dropdown */}
            {showFilters && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-xl p-4 space-y-3">
                {availableFilters.map(filter => (
                  <div key={filter.key} className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      {filter.label}
                    </label>
                    {filter.type === 'select' ? (
                      <select
                        value={filters[filter.key] || ''}
                        onChange={(e) => onFiltersChange({ ...filters, [filter.key]: e.target.value || null })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground"
                      >
                        <option value="">Todas</option>
                        {filter.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : filter.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters[filter.key] || false}
                          onChange={(e) => onFiltersChange({ ...filters, [filter.key]: e.target.checked || null })}
                          className="rounded border-border"
                        />
                        <span className="text-sm">{filter.label}</span>
                      </label>
                    ) : null}
                  </div>
                ))}

                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => onFiltersChange({})}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}