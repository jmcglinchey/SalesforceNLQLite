import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchResult } from "@shared/schema";
import { truncateText, getObjectColor, getFieldTypeIcon, getConfidenceBadgeClass } from "@/lib/utils";

interface SearchResultsProps {
  results: SearchResult[];
  summary: string;
  onFieldSelect: (field: SearchResult) => void;
}

export default function SearchResults({ results, summary, onFieldSelect }: SearchResultsProps) {
  // Sort results by match confidence (High > Medium > Low > null)
  const confidenceOrder = { High: 1, Medium: 2, Low: 3 };
  const sortedResults = [...results].sort((a, b) => {
    const confidenceA = a.matchConfidence || 'Low';
    const confidenceB = b.matchConfidence || 'Low';
    const orderA = confidenceOrder[confidenceA as keyof typeof confidenceOrder] || 4;
    const orderB = confidenceOrder[confidenceB as keyof typeof confidenceOrder] || 4;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // Secondary sort by field label
    return a.fieldLabel.localeCompare(b.fieldLabel);
  });

  return (
    <section className="mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Search Results</h3>
            <span className="text-sm text-slate-500">{summary}</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Match Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Field Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">API Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Object</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Help Text</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {sortedResults.map((field, index) => (
                <tr key={`${field.objectApiName}-${field.fieldApiName}-${index}`} className="hover:bg-slate-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getConfidenceBadgeClass(field.matchConfidence)}>
                      {field.matchConfidence || '-'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{field.fieldLabel}</div>
                    {field.isCustom && (
                      <Badge variant="outline" className="mt-1 text-xs">Custom</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">{field.fieldApiName}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getObjectColor(field.objectLabel)}>{field.objectLabel}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-600">{field.dataType}</span>
                      {field.picklistValues && field.picklistValues.length > 0 && (
                        <Badge variant="secondary" className="text-xs">Picklist</Badge>
                      )}
                      {field.formula && (
                        <Badge variant="secondary" className="text-xs">Formula</Badge>
                      )}
                      {field.isRequired && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 max-w-xs">
                      {field.description ? truncateText(field.description, 100) : (
                        <span className="italic text-slate-400">No description available</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 max-w-xs">
                      {field.helpText ? truncateText(field.helpText, 100) : (
                        <span className="italic text-slate-400">No help text available</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFieldSelect(field)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
