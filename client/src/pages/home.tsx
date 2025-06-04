import { useState, useEffect } from "react";
import { Search, Database, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QueryInput from "@/components/query-input";
import SearchResults from "@/components/search-results";
import ObjectResults from "@/components/object-results";
import FieldDetailsModal from "@/components/field-details-modal";
import ExampleQueries from "@/components/example-queries";
import LoadingState from "@/components/loading-state";
import EmptyState from "@/components/empty-state";
import CSVUpload from "@/components/csv-upload";
import { SearchResult, SalesforceObject } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const [selectedField, setSelectedField] = useState<SearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [objectResults, setObjectResults] = useState<SalesforceObject[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultSummary, setResultSummary] = useState<string>("");
  const [narrativeSummary, setNarrativeSummary] = useState<string>("");

  // Check if database has data
  const { data: uploadStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/upload-status'],
    queryFn: async () => {
      const response = await fetch('/api/upload-status');
      return response.json();
    }
  });

  const handleSearchResults = (fieldResults: SearchResult[], objectResults: SalesforceObject[], summary: string, narrativeSummary?: string) => {
    setSearchResults(fieldResults);
    setObjectResults(objectResults);
    setResultSummary(summary);
    setNarrativeSummary(narrativeSummary || "");
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

  const handleUploadComplete = () => {
    refetchStatus();
  };

  const showResults = hasSearched && !isSearching && searchResults.length > 0;
  const showNoResults = hasSearched && !isSearching && searchResults.length === 0;
  const showEmpty = !hasSearched && !isSearching;
  const showUpload = !uploadStatus?.hasData;

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
        {showUpload ? (
          /* Upload Section */
          <section className="mb-12">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Get Started</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Upload your Salesforce field metadata CSV file to start asking questions about your data in plain English
              </p>
            </div>
            
            <CSVUpload onUploadComplete={handleUploadComplete} />
          </section>
        ) : (
          <>
            {/* Query Input Section */}
            <section className="mb-12">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <div className="text-center mb-8">
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">What would you like to know?</h2>
                  <p className="text-slate-600">Ask questions about Salesforce fields, objects, and data in plain English</p>
                  {uploadStatus?.fieldCount && (
                    <p className="text-sm text-slate-500 mt-2">
                      Database contains {uploadStatus.fieldCount} fields ready for queries
                    </p>
                  )}
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

            {/* AI Summary Section */}
            {showResults && narrativeSummary && (
              <section className="mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
                      AI Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700 leading-relaxed">{narrativeSummary}</p>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Object Results */}
            {objectResults.length > 0 && (
              <ObjectResults 
                results={objectResults}
                summary={`Found ${objectResults.length} relevant object(s)`}
              />
            )}

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
          </>
        )}

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
