import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SearchResult, SalesforceObject } from "@shared/schema";

interface QueryInputProps {
  onSearchStart: () => void;
  onSearchResults: (fieldResults: SearchResult[], objectResults: SalesforceObject[], summary: string, narrativeSummary?: string) => void;
  onSearchError: () => void;
}

export default function QueryInput({ onSearchStart, onSearchResults, onSearchError }: QueryInputProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Please enter a query",
        description: "Type a question about Salesforce fields to search.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    onSearchStart();

    try {
      const response = await apiRequest("POST", "/api/search", { query: query.trim() });
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || "Search failed");
      }

      onSearchResults(
        data.fieldResults || data.results || [], 
        data.objectResults || [],
        data.summary || `Found ${data.resultCount || 0} results`,
        data.narrativeSummary || ""
      );
      
      toast({
        title: "Search completed",
        description: data.summary || `Found ${data.resultCount || 0} results`,
      });

    } catch (error) {
      console.error("Search error:", error);
      onSearchError();
      
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Unable to process your query. Please try rephrasing your question.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch();
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative">
        <Input
          type="text"
          placeholder="e.g., Show me all date fields on the Opportunity object"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full px-6 py-4 pr-32 text-lg border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder-slate-400 bg-white shadow-sm"
          disabled={isLoading}
        />
        <Button
          onClick={handleSearch}
          disabled={isLoading}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 px-8 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 shadow-sm"
        >
          <Search className="h-4 w-4 mr-2" />
          Ask
        </Button>
      </div>
    </div>
  );
}
