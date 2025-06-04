import { useState, useEffect } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ExampleQueriesProps {
  onQuerySelect?: (query: string) => void;
}

const defaultExamples = [
  "Show me all picklist fields on the Account object",
  "What fields contain sensitive customer information?",
  "Find formula fields related to revenue calculation",
  "Show me address fields on Contact object",
  "What date fields are available on Case object?",
  "Find all custom fields on Opportunity"
];

export default function ExampleQueries({ onQuerySelect }: ExampleQueriesProps) {
  const [examples, setExamples] = useState<string[]>(defaultExamples);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch example queries from the API
    fetch("/api/examples")
      .then(res => res.json())
      .then(data => {
        if (data.examples && Array.isArray(data.examples)) {
          setExamples(data.examples);
        }
      })
      .catch(error => {
        console.error("Failed to fetch examples:", error);
        // Keep default examples on error
      });
  }, []);

  const handleExampleClick = (query: string) => {
    if (onQuerySelect) {
      onQuerySelect(query);
    } else {
      // Fallback: copy to clipboard or trigger search input
      navigator.clipboard.writeText(query).then(() => {
        toast({
          title: "Query copied",
          description: "The example query has been copied to your clipboard.",
        });
      }).catch(() => {
        // Fallback if clipboard API is not available
        const input = document.querySelector('input[placeholder*="Show me all"]') as HTMLInputElement;
        if (input) {
          input.value = query;
          input.focus();
        }
      });
    }
  };

  return (
    <section className="mb-12">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-lg font-medium text-slate-900 mb-4 text-center">Try these example queries:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {examples.map((query, index) => (
            <Button
              key={index}
              variant="outline"
              className="text-left p-4 h-auto bg-white border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all duration-200 group justify-start"
              onClick={() => handleExampleClick(query)}
            >
              <div className="flex items-start space-x-3 w-full">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-700 group-hover:text-primary text-left whitespace-normal">
                  "{query}"
                </span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
