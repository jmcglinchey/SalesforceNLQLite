import { SalesforceObject } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";

interface ObjectResultsProps {
  results: SalesforceObject[];
  summary?: string;
}

export default function ObjectResults({ results, summary }: ObjectResultsProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Relevant Objects</h3>
        {summary && <p className="text-sm text-slate-600 dark:text-slate-400">{summary}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((obj) => (
          <Card key={obj.objectApiName} className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-slate-900 dark:text-slate-100">
                <Database className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                {obj.objectLabel}
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                API Name: <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">{obj.objectApiName}</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 min-h-[40px]">
                {obj.description ? (
                  obj.description.length > 150 
                    ? obj.description.substring(0, 150) + '...'
                    : obj.description
                ) : (
                  <span className="italic text-slate-500 dark:text-slate-400">No description available.</span>
                )}
              </p>
              <div className="flex flex-wrap gap-1">
                {obj.isCustom && (
                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 dark:border-orange-600 dark:text-orange-400">
                    Custom
                  </Badge>
                )}
                {obj.keyPrefix && (
                  <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {obj.keyPrefix}
                  </Badge>
                )}
                {obj.tags && obj.tags.split(',').map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
              {obj.pluralLabel && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Plural: {obj.pluralLabel}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}