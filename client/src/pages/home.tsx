import { useState } from "react";
import { Search } from "lucide-react";
import QueryInput from "@/components/query-input";
import SearchResults from "@/components/search-results";
import FieldDetailsModal from "@/components/field-details-modal";
import ExampleQueries from "@/components/example-queries";
import LoadingState from "@/components/loading-state";
import EmptyState from "@/components/empty-state";
import { SearchResult } from "@shared/schema";

export default function Home() {
  const [selectedField, setSelectedField] = useState<SearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultSummary, setResultSummary] = useState<string>("");

  const handleSearchResults = (results: SearchResult[], summary: string) => {
    setSearchResults(results);
    setResultSummary(summary);
    setHasSearched(true);
    setIsSearching(false);
  };

  const handleSearchStart = () => {
    setIsSearching(true);
    setHasSearched(false);
  };

  const handleSearchError = () => {
    setIsSearching(false);
    setHasSearched(true);
    setSearchResults([]);
    setResultSummary("Search failed. Please try again.");
  };

  const showResults = hasSearched && !isSearching && searchResults.length > 0;
  const showNoResults = hasSearched && !isSearching && searchResults.length === 0;
  const showEmpty = !hasSearched && !isSearching;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Search className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Salesforce Data Dictionary</h1>
                <p className="text-sm text-slate-600 mt-1">Ask questions about your Salesforce fields and objects</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Query Input Section */}
        <section className="mb-12">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">What would you like to know?</h2>
              <p className="text-slate-600">Ask questions about Salesforce fields, objects, and data in plain English</p>
            </div>
            
            <QueryInput 
              onSearchStart={handleSearchStart}
              onSearchResults={handleSearchResults}
              onSearchError={handleSearchError}
            />
          </div>
        </section>

        {/* Example Queries */}
        <ExampleQueries />

        {/* Loading State */}
        {isSearching && <LoadingState />}

        {/* Search Results */}
        {showResults && (
          <SearchResults 
            results={searchResults}
            summary={resultSummary}
            onFieldSelect={setSelectedField}
          />
        )}

        {/* No Results State */}
        {showNoResults && (
          <section className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
              <p className="text-slate-600 mb-4">Try rephrasing your question or use different keywords. Check out the example queries above for inspiration.</p>
            </div>
          </section>
        )}

        {/* Empty State */}
        {showEmpty && <EmptyState />}

        {/* Field Details Modal */}
        <FieldDetailsModal 
          field={selectedField}
          isOpen={selectedField !== null}
          onClose={() => setSelectedField(null)}
        />
      </main>
    </div>
  );
}
