{{/*
Expand the name of the chart.
*/}}
{{- define "thaliumx.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "thaliumx.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "thaliumx.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "thaliumx.labels" -}}
helm.sh/chart: {{ include "thaliumx.chart" . }}
{{ include "thaliumx.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: thaliumx
{{- end }}

{{/*
Selector labels
*/}}
{{- define "thaliumx.selectorLabels" -}}
app.kubernetes.io/name: {{ include "thaliumx.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "thaliumx.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "thaliumx.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Backend service name
*/}}
{{- define "thaliumx.backend.fullname" -}}
{{- printf "%s-backend" (include "thaliumx.fullname" .) }}
{{- end }}

{{/*
Frontend service name
*/}}
{{- define "thaliumx.frontend.fullname" -}}
{{- printf "%s-frontend" (include "thaliumx.fullname" .) }}
{{- end }}

{{/*
Trading service name
*/}}
{{- define "thaliumx.trading.fullname" -}}
{{- printf "%s-trading" (include "thaliumx.fullname" .) }}
{{- end }}

{{/*
Fintech service name
*/}}
{{- define "thaliumx.fintech.fullname" -}}
{{- printf "%s-fintech" (include "thaliumx.fullname" .) }}
{{- end }}

{{/*
Create image pull secret
*/}}
{{- define "thaliumx.imagePullSecret" -}}
{{- with .Values.global.imageCredentials }}
{{- printf "{\"auths\":{\"%s\":{\"username\":\"%s\",\"password\":\"%s\",\"email\":\"%s\",\"auth\":\"%s\"}}}" .registry .username .password .email (printf "%s:%s" .username .password | b64enc) | b64enc }}
{{- end }}
{{- end }}

{{/*
Return the proper image name
*/}}
{{- define "thaliumx.image" -}}
{{- $registryName := .Values.global.imageRegistry -}}
{{- $repositoryName := .repository -}}
{{- $tag := .tag | default "latest" -}}
{{- printf "%s/%s:%s" $registryName $repositoryName $tag -}}
{{- end -}}

{{/*
Return PostgreSQL host
*/}}
{{- define "thaliumx.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "thaliumx.fullname" .) }}
{{- else }}
{{- .Values.externalDatabase.host }}
{{- end }}
{{- end }}

{{/*
Return Redis host
*/}}
{{- define "thaliumx.redis.host" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "thaliumx.fullname" .) }}
{{- else }}
{{- .Values.externalRedis.host }}
{{- end }}
{{- end }}

{{/*
Return Kafka brokers
*/}}
{{- define "thaliumx.kafka.brokers" -}}
{{- if .Values.kafka.enabled }}
{{- printf "%s-kafka:9092" (include "thaliumx.fullname" .) }}
{{- else }}
{{- .Values.externalKafka.brokers }}
{{- end }}
{{- end }}