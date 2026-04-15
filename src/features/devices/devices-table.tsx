"use client";

import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

export function DevicesTable() {
  const { tokens } = useAuth();
  const [query, setQuery] = useState("");
  const devicesQuery = useDevices(tokens?.accessToken);

  const filtered = useMemo(() => {
    const devices = devicesQuery.data?.data || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return devices;
    return devices.filter((device) =>
      [device.deviceId, device.name, device.firmwareVersion, device.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [devicesQuery.data?.data, query]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Operación"
        title="Dispositivos"
        description="Catálogo operativo de dispositivos visibles hoy. El diseño queda preparado para sumar snapshots lossless y trazabilidad raw por sync."
        actions={<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por deviceId, nombre o firmware" className="w-80" />}
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {devicesQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : devicesQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(devicesQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Firmware</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Metadata</TableHead>
                  <TableHead>Actualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No hay dispositivos para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.name}</TableCell>
                      <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
                      <TableCell>{device.firmwareVersion || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={device.status ? "success" : "outline"}>{device.status || "sin estado"}</Badge>
                      </TableCell>
                      <TableCell className="max-w-80 truncate text-xs text-muted-foreground">
                        {Object.keys(device.deviceMetadata).length > 0
                          ? JSON.stringify(device.deviceMetadata)
                          : "sin metadata"}
                      </TableCell>
                      <TableCell>{formatDateTime(device.updatedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
