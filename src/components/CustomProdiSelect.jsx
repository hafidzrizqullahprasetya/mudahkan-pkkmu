import { useDropdownSearch } from "../hooks/useDropdownSearch";

export function CustomProdiSelect({ options, value, onChange, error, hasFaculty }) {
  const { isOpen, setIsOpen, searchTerm, setSearchTerm, dropdownRef, menuRef, searchInputRef } = useDropdownSearch();

  const filteredOptions = options.filter((item) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return item.toLowerCase().includes(term);
  });

  const handleSelectOption = (item) => {
    onChange(item);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-wrapper ${isOpen ? "custom-select-wrapper--open" : ""}`} ref={dropdownRef}>
      <input type="hidden" name="prodi" value={value} />
      <button
        type="button"
        disabled={!hasFaculty}
        className={`custom-select-trigger ${isOpen ? "custom-select-trigger--open" : ""} ${error ? "custom-select-trigger--error" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {value ? (
          <div className="custom-select-selected">
            <span className="select-text"><b>{value}</b></span>
          </div>
        ) : (
          <span className="select-placeholder">{hasFaculty ? "-- Pilih Program Studi --" : "-- Pilih Fakultas terlebih dahulu --"}</span>
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
              placeholder="Cari program studi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="custom-select-options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item) => {
                const isSelected = item === value;
                return (
                  <div
                    key={item}
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? "custom-select-option--selected" : ""}`}
                    onClick={() => handleSelectOption(item)}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleSelectOption(item);
                    }}
                  >
                    <div className="option-info">
                      <strong>{item}</strong>
                    </div>
                    {isSelected && <span className="option-check">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="custom-select-empty">
                {hasFaculty ? `Tidak ada program studi yang cocok dengan "${searchTerm}"` : "Pilih PKKBN Fakultas terlebih dahulu untuk melihat program studi."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

