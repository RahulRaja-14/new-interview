import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload, FileText, X } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  accept?: string;
  className?: string;
}

export function FileUpload({ onFileSelect, selectedFile, accept = ".pdf,.doc,.docx", className }: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onFileSelect(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-lg",
          "bg-secondary border border-border",
          "hover:border-primary/50 hover:bg-secondary/80",
          "transition-all duration-200",
          "text-left"
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-foreground font-medium">Choose File</span>
        {selectedFile && (
          <span className="text-muted-foreground truncate flex-1">
            {selectedFile.name}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {selectedFile && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Selected: {selectedFile.name}</span>
          <button
            type="button"
            onClick={handleRemove}
            className="ml-auto p-1 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
