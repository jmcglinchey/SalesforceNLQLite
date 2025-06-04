import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SearchResult } from "@shared/schema";
import { getObjectColor } from "@/lib/utils";

interface FieldDetailsModalProps {
  field: SearchResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FieldDetailsModal({ field, isOpen, onClose }: FieldDetailsModalProps) {
  if (!field) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900">{field.fieldLabel}</DialogTitle>
              <p className="text-sm text-slate-600 mt-1">
                <code className="bg-slate-100 px-2 py-1 rounded text-xs">{field.fieldApiName}</code>
                <span className="mx-2">•</span>
                <span>{field.objectLabel}</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-96 space-y-6">
          {/* Field Information */}
          <div>
            <h4 className="text-sm font-medium text-slate-900 mb-3">Field Information</h4>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Data Type:</span>
                <span className="font-medium text-slate-900">{field.dataType}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Object:</span>
                <Badge className={getObjectColor(field.objectLabel)}>{field.objectLabel}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Required:</span>
                <Badge variant={field.isRequired ? "destructive" : "secondary"}>
                  {field.isRequired ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Custom Field:</span>
                <Badge variant={field.isCustom ? "outline" : "secondary"}>
                  {field.isCustom ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Description */}
          {field.description && (
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Description</h4>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg">
                {field.description}
              </p>
            </div>
          )}

          {/* Help Text */}
          {field.helpText && (
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Help Text</h4>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg">
                {field.helpText}
              </p>
            </div>
          )}

          {/* Picklist Values */}
          {field.picklistValues && field.picklistValues.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Picklist Values</h4>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {field.picklistValues.map((value, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {value}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Formula */}
          {field.formula && (
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Formula</h4>
              <div className="bg-slate-50 rounded-lg p-4">
                <code className="text-sm text-slate-700 font-mono block whitespace-pre-wrap">
                  {field.formula}
                </code>
                <p className="text-xs text-slate-600 mt-2">
                  This formula determines how the field value is calculated automatically.
                </p>
              </div>
            </div>
          )}

          {/* Tags */}
          {field.tags && field.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {field.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className="flex justify-end">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
