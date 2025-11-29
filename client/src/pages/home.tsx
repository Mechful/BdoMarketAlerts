import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchResult {
  id: number;
  name: string;
}

interface ItemSearchProps {
  onSelect: (item: SearchResult) => void;
  placeholder?: string;
}

export function ItemSearch({ onSelect, placeholder = "Search item name..." }: ItemSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const { data: results = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/search-items", searchValue],
    enabled: searchValue.length >= 2,
  });

  const handleSelect = (item: SearchResult) => {
    onSelect(item);
    setSearchValue("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-left"
          data-testid="button-search-items"
        >
          <Search className="h-4 w-4 mr-2" />
          {searchValue || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 mr-2 opacity-50" />
            <Input
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="input-item-search"
              autoFocus
            />
          </div>
          <CommandList>
            {searchValue.length < 2 ? (
              <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No items found</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={() => handleSelect(item)}
                    data-testid={`search-result-${item.id}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">ID: {item.id}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
