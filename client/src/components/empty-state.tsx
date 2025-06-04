import { Database } from "lucide-react";

export default function EmptyState() {
  return (
    <section className="text-center py-16">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Database className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">Ready to explore your Salesforce data</h3>
        <p className="text-slate-600">Ask a question above to discover fields, objects, and metadata in your Salesforce org.</p>
      </div>
    </section>
  );
}
