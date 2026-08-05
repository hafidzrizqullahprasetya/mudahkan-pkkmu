import { useDropdownSearch } from "../hooks/useDropdownSearch";

export function CustomPkkbnSelect({ scopes, value, onChange, error }) {
  const { isOpen, setIsOpen, searchTerm, setSearchTerm, dropdownRef, menuRef, searchInputRef } = useDropdownSearch();

  const selectedScope = scopes.find((s) => s.name === value);

  const filteredScopes = scopes.filter((scope) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      scope.name.toLowerCase().includes(term) ||
      scope.code.toLowerCase().includes(term) ||
      scope.type.toLowerCase().includes(term)
    );
  });

  const handleSelectScope = (scopeName) => {
    onChange(scopeName);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-wrapper ${isOpen ? "custom-select-wrapper--open" : ""}`} ref={dropdownRef}>
      <input type="hidden" name="faculty" value={value} />
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? "custom-select-trigger--open" : ""} ${error ? "custom-select-trigger--error" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {selectedScope ? (
          <div className="custom-select-selected">
            <span className="select-badge">{selectedScope.code}</span>
            <span className="select-text"><b>{selectedScope.name}</b><small className="select-type-small"> • {selectedScope.type}</small></span>
          </div>
        ) : (
          <span className="select-placeholder">-- Pilih Lini PKKBN Fakultas --</span>
        )}
        <span className="select-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="custom-select-menu" role="listbox" ref={menuRef}>
          <div className="custom-select-search-box">
            <input
              ref={searchInputRef}
              type="text"
              className="custom-select-search-input"
              placeholder="Cari PKKBN atau fakultas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="custom-select-options-list">
            {filteredScopes.length > 0 ? (
              filteredScopes.map((scope) => {
                const isSelected = scope.name === value;
                return (
                  <div
                    key={scope.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? "custom-select-option--selected" : ""}`}
                    onClick={() => handleSelectScope(scope.name)}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleSelectScope(scope.name);
                    }}
                  >
                    <span className="option-badge">{scope.code}</span>
                    <div className="option-info">
                      <strong>{scope.name}</strong>
                      <small>{scope.type}</small>
                    </div>
                    {isSelected && <span className="option-check">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="custom-select-empty">
                Tidak ada PKKBN yang cocok dengan "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

