"use client";

import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useSyncSessions } from "@/features/syncs/api";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

export function SyncsTable() {
  const { tokens } = useAuth();
  const [query, setQuery] = useState("");
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const filtered = useMemo(() => {
    const syncs = syncsQuery.data?.data || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return syncs;
    return syncs.filter((sync) =>
      [sync.syncId, sync.source, sync.deckName, sync.bleDeviceId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [syncsQuery.data?.data, query]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Trazabilidad"
        title="Sincronizaciones"
        description="Módulo base para inspeccionar sesiones sincronizadas. Usa endpoint canónico cuando exista y cae a `home/sessions/history` como fallback temporal."
        actions={<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por syncId, origen o mazo" className="w-80" />}
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {syncsQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : syncsQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(syncsQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sync ID</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Mazo</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead>Raw</TableHead>
                  <TableHead>Sincronizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay sincronizaciones para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell className="max-w-56 truncate font-mono text-xs">{sync.syncId || sync.id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{sync.source || sync.sourceType || "desconocido"}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{sync.bleDeviceId || sync.deviceId || "-"}</TableCell>
                      <TableCell>{sync.deckName || "-"}</TableCell>
                      <TableCell>{sync.participants.length || sync.totalPlayers || 0}</TableCell>
                      <TableCell>
                        {sync.rawRecordIds.length > 0 || sync.rawPayload ? (
                          <Badge variant="success">disponible</Badge>
                        ) : (
                          <Badge variant="outline">pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(sync.syncedAt || sync.startedAt)}</TableCell>
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
