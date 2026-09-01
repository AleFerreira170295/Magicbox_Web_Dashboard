/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
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

const imageUploadMessages: Record<AppLanguage, {
  label: string;
  description: string;
  previewAlt: string;
  empty: string;
  ready: string;
  current: string;
  upload: string;
  fileReady: (name: string, sizeKb: number) => string;
  replace: string;
  instructions: string;
  change: string;
  browse: string;
  discard: string;
  removeCurrent: string;
}> = {
  es: {
    label: "Imagen",
    description: "Arrastrá una imagen o buscala en tu computadora. Formatos: PNG, JPG, JPEG, GIF o WEBP.",
    previewAlt: "Vista previa",
    empty: "Todavía no hay imagen cargada.",
    ready: "Imagen lista para subir",
    current: "Imagen actual",
    upload: "Subí una imagen",
    fileReady: (name, sizeKb) => `${name} · ${sizeKb} KB. Guardamos la imagen al confirmar el formulario.`,
    replace: "Podés reemplazar la imagen arrastrando otra encima o buscándola desde tu computadora.",
    instructions: "Podés arrastrar una imagen a esta zona o hacer click para seleccionarla desde tu computadora.",
    change: "Cambiar imagen",
    browse: "Buscar imagen",
    discard: "Descartar archivo",
    removeCurrent: "Quitar imagen actual",
  },
  en: {
    label: "Image",
    description: "Drag an image here or choose one from your computer. Formats: PNG, JPG, JPEG, GIF, or WEBP.",
    previewAlt: "Preview",
    empty: "No image has been uploaded yet.",
    ready: "Image ready to upload",
    current: "Current image",
    upload: "Upload an image",
    fileReady: (name, sizeKb) => `${name} · ${sizeKb} KB. The image will be saved when you confirm the form.`,
    replace: "You can replace the image by dragging another one here or choosing it from your computer.",
    instructions: "You can drag an image to this area or click to select it from your computer.",
    change: "Change image",
    browse: "Choose image",
    discard: "Discard file",
    removeCurrent: "Remove current image",
  },
  pt: {
    label: "Imagem",
    description: "Arraste uma imagem ou procure no seu computador. Formatos: PNG, JPG, JPEG, GIF ou WEBP.",
    previewAlt: "Pré-visualização",
    empty: "Ainda não há imagem carregada.",
    ready: "Imagem pronta para envio",
    current: "Imagem atual",
    upload: "Envie uma imagem",
    fileReady: (name, sizeKb) => `${name} · ${sizeKb} KB. Salvamos a imagem ao confirmar o formulário.`,
    replace: "Você pode substituir a imagem arrastando outra aqui ou procurando no seu computador.",
    instructions: "Você pode arrastar uma imagem para esta área ou clicar para selecioná-la no computador.",
    change: "Trocar imagem",
    browse: "Procurar imagem",
    discard: "Descartar arquivo",
    removeCurrent: "Remover imagem atual",
  },
};

export function ImageUploadField({
  value,
  file,
  onFileChange,
  onRemoveCurrent,
  disabled = false,
  label,
  description,
}: ImageUploadFieldProps) {
  const { language } = useLanguage();
  const t = imageUploadMessages[language];
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
        <p className="text-sm font-medium text-foreground">{label || t.label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description || t.description}</p>
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
              <img src={previewUrl} alt={t.previewAlt} className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <ImagePlus className="size-7 text-primary/70" />
                <p className="px-4 text-sm">{t.empty}</p>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Upload className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                {file ? t.ready : value ? t.current : t.upload}
              </p>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {file
                ? t.fileReady(file.name, Math.max(1, Math.round(file.size / 1024)))
                : value
                  ? t.replace
                  : t.instructions}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={pickFile} disabled={disabled}>
                {file || value ? t.change : t.browse}
              </Button>
              {file ? (
                <Button type="button" variant="ghost" onClick={() => onFileChange(null)} disabled={disabled}>
                  {t.discard}
                </Button>
              ) : null}
              {!file && value && onRemoveCurrent ? (
                <Button type="button" variant="ghost" onClick={onRemoveCurrent} disabled={disabled}>
                  <Trash2 className="size-4" />
                  {t.removeCurrent}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
