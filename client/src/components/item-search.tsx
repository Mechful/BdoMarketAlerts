import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Search, X } from "lucide-react";

interface SearchResult {
  id: number;
  name: string;
  icon: string;
  supportsEnhancement: boolean;
  itemType: 'accessory' | 'equipment' | 'other';
  maxEnhancement: number;
}

interface ItemSearchProps {
  onSelect: (id: number, name: string, supportsEnhancement: boolean, itemType: 'accessory' | 'equipment' | 'other', maxEnhancement: number) => void;
  placeholder?: string;
  selectedId?: string;
  selectedName?: string;
  selectedIcon?: string;
  onClear?: () => void;
}

export function ItemSearch({ onSelect, placeholder = "Search item name...", selectedId, selectedName, selectedIcon, onClear }: ItemSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiRequest("GET", `/api/search-items?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: number, name: string, supportsEnhancement: boolean, itemType: 'accessory' | 'equipment' | 'other', maxEnhancement: number) => {
    onSelect(id, name, supportsEnhancement, itemType, maxEnhancement);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    onClear?.();
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        {selectedName ? (
          <div className="flex items-center gap-2 p-2 rounded-md border border-input bg-background">
            <img 
              src={selectedIcon} 
              alt={selectedName} 
              className="w-6 h-6 rounded bg-muted"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon.png";
              }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{selectedName}</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-muted rounded"
              data-testid="button-clear-item"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && setIsOpen(true)}
              className="pl-10"
              data-testid="input-item-search"
            />
          </>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto bg-card border border-border">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Searching...</div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id, item.name, item.supportsEnhancement, item.itemType, item.maxEnhancement)}
                  className="w-full flex items-center gap-3 p-3 hover-elevate transition-colors text-left"
                  data-testid={`search-result-${item.id}`}
                >
                  <img
                    src={item.icon}
                    alt={item.name}
                    className="w-8 h-8 rounded bg-background"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/favicon.png";
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">No items found</div>
          )}
        </Card>
      )}
    </div>
  );
}
