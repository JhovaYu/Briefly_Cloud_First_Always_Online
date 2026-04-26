# Contexto Briefly — Migración Cloud-First (Estado Actual)

## Proyecto
Briefly — aplicación de notas colaborativas en tiempo real.

## Estado actual del sistema
- Arquitectura original: P2P / local-first
- Tecnologías: Yjs + WebRTC + Electron + almacenamiento local
- No existe backend cloud autoritativo implementado
- No existen microservicios desplegados
- Solo existe integración parcial con Supabase Auth

## Objetivo de la migración
Migrar a arquitectura:
- Cloud-first
- Always-online
- Backend autoritativo en AWS
- Compatible con requisitos académicos:
  - AWS Academy Learner Lab
  - Presupuesto: $50 USD
  - 5 microservicios obligatorios
  - Demo de 3 usuarios durante 2 horas

## Arquitectura aprobada (v2.1)

### Infraestructura
- EC2 t3.medium (o superior) como host único
- Docker Compose con 5 microservicios
- Nginx como reverse proxy
- CloudFront como punto de entrada único
- VPC con subred pública (sin NAT Gateway)
- DynamoDB (tablas por servicio)
- S3 (frontend + snapshots)
- Supabase Auth (v1)

### Microservicios
1. Workspace Service
2. Collaboration Service (pycrdt-websocket)
3. Planning Service
4. Intelligence Service
5. Utility Service

### Decisiones críticas
- Backend: Python 3.12 + FastAPI
- Reemplazo de Hocuspocus → pycrdt-websocket
- TLS termina en CloudFront
- EC2 usa HTTP (puerto 80)
- Nginx valida X-Shared-Secret
- Planning NO usa realtime (usa REST + React Query)
- Sin soporte offline soberano en v1

## Documento de arquitectura
Archivo principal:
briefly-architecture-cloud-first-plan-v2.1.md

Este documento define:
- arquitectura completa
- decisiones técnicas
- riesgos
- runbook de demo

## Documento de ejecución
Archivo:
migracion_briefly.md

Define:
- fases de implementación
- checklist por fase
- criterios de aceptación
- runbook operativo
- reglas para agentes

## Herramienta de ejecución
- Claude Code + Minimax M2.7
- Plugins activos:
  - serena
  - feature-dev
  - security-guidance
  - context7
  - pyright-lsp
  - claude-md-management
  - remember
  - typescript-lsp (cuando aplique)
  - playwright (solo fases finales)

## Estado actual de implementación

### PM-01 (Foundation backend)
- Prompt maestro ya enviado a Minimax
- Minimax respondió con:
  - análisis del repo
  - propuesta de estructura
  - identificación de riesgos
  - plan preliminar (con ruido)

### Decisión tomada
No ejecutar implementación todavía.

Se eligió:
- Opción B (refinamiento del plan antes de ejecutar)

### Acción actual (último paso realizado)

Se envió prompt para:

- generar archivo:
  /docs/migration/PM-01-foundation-plan.md

- objetivo:
  refinar plan eliminando ruido y validando decisiones clave

### Estado actual

- Esperando output refinado de Minimax
- No se ha modificado el código aún
- No se ha creado estructura backend todavía

## Reglas activas

- No implementar sin plan aprobado
- No avanzar de fase sin validación
- No introducir complejidad innecesaria
- Priorizar estabilidad de demo sobre pureza arquitectónica
- Diseñar primero, implementar después

## Riesgos actuales

CRÍTICOS:
- Compatibilidad Yjs ↔ pycrdt-websocket
- estabilidad WebSocket detrás de proxy
- consumo de memoria en EC2

ALTOS:
- configuración Nginx (headers + routing)
- configuración CloudFront WebSocket
- manejo correcto de JWT Supabase

## Siguiente paso esperado

Recibir archivo:
PM-01-foundation-plan.md

Luego:
1. Auditar plan
2. Ajustar si es necesario
3. Aprobar implementación
4. Ejecutar PM-01

## Objetivo inmediato

Lograr:
- backend base levantando en local
- Docker Compose funcional
- Nginx routing correcto
- healthchecks operativos

Sin implementar aún:
- auth
- DynamoDB
- S3
- colaboración real

## Nota final

Este proyecto está en modo:
Hackathon técnico controlado

Prioridad:
- demo estable > arquitectura perfecta
- simplicidad > elegancia innecesaria
- control > automatización excesiva