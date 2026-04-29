/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageUploadFieldProps = {
  value?: string | null;
  file?: File | null;
  onFileChange: (file: File | null) => void;
  onRemoveCurrent?: () => void;
  disabled?: boolean;
  label?: string;
  description?: string;
};

export function ImageUploadField({
  value,
  file,
  onFileChange,
  onRemoveCurrent,
  disabled = false,
  label = "Imagen",
  description = "Arrastrá una imagen o buscala en tu computadora. Formatos: PNG, JPG, JPEG, GIF o WEBP.",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return value || "";
  }, [file, value]);

  useEffect(() => {
    if (!file || !previewUrl.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [file, previewUrl]);

  function pickFile() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    const nextFile = files?.[0] || null;
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) return;
    onFileChange(nextFile);
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={pickFile}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pickFile();
          }
        }}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "group rounded-[24px] border border-dashed bg-background/80 p-4 transition sm:p-5",
          disabled && "cursor-not-allowed opacity-60",
          !disabled && "cursor-pointer hover:border-primary/45 hover:bg-primary/5",
          isDragging && "border-primary bg-primary/8 shadow-[0_0_0_4px_rgba(71,185,239,0.12)]",
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
          <div className="overflow-hidden rounded-[20px] border border-border/70 bg-white">
            {previewUrl ? (
              <img src={previewUrl} alt="Vista previa" className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <ImagePlus className="size-7 text-primary/70" />
                <p className="px-4 text-sm">Todavía no hay imagen cargada.</p>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Upload className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                {file ? "Imagen lista para subir" : value ? "Imagen actual" : "Subí una imagen"}
              </p>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {file
                ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB. Guardamos la imagen al confirmar el formulario.`
                : value
                  ? "Podés reemplazar la imagen arrastrando otra encima o buscándola desde tu computadora."
                  : "Podés arrastrar una imagen a esta zona o hacer click para seleccionarla desde tu computadora."}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={pickFile} disabled={disabled}>
                {file || value ? "Cambiar imagen" : "Buscar imagen"}
              </Button>
              {file ? (
                <Button type="button" variant="ghost" onClick={() => onFileChange(null)} disabled={disabled}>
                  Descartar archivo
                </Button>
              ) : null}
              {!file && value && onRemoveCurrent ? (
                <Button type="button" variant="ghost" onClick={onRemoveCurrent} disabled={disabled}>
                  <Trash2 className="size-4" />
                  Quitar imagen actual
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
