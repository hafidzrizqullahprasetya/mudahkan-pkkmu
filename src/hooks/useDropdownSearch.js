import { useState, useEffect, useRef } from "react";

export function useDropdownSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      const pad = 24;
      setTimeout(() => {
        searchInputRef.current?.focus();
        menuRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        requestAnimationFrame(() => {
          const rect = menuRef.current?.getBoundingClientRect();
          if (rect) {
            const overflow = rect.bottom - (window.innerHeight - pad);
            if (overflow > 0) {
              window.scrollBy({ top: overflow, behavior: "smooth" });
            }
          }
        });
      }, 50);
    }
  }, [isOpen]);

  return { isOpen, setIsOpen, searchTerm, setSearchTerm, dropdownRef, menuRef, searchInputRef };
}

