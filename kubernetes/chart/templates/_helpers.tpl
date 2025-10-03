{{/*
Expand the name of the chart.
*/}}
{{- define "sourcebot.name" -}}
{{- default $.Chart.Name $.Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "sourcebot.fullname" -}}
{{- if $.Values.fullnameOverride }}
{{- $.Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default $.Chart.Name $.Values.nameOverride }}
{{- if contains $name $.Release.Name }}
{{- $.Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" $.Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "sourcebot.chart" -}}
{{- printf "%s-%s" $.Chart.Name $.Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "sourcebot.labels" -}}
helm.sh/chart: {{ include "sourcebot.chart" $ }}
{{ include "sourcebot.selectorLabels" $ }}
{{- if $.Chart.AppVersion }}
app.kubernetes.io/version: {{ $.Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ $.Release.Service }}
{{- with $.Values.additionalLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "sourcebot.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sourcebot.name" $ }}
app.kubernetes.io/instance: {{ $.Release.Name }}
{{- end }}

{{/*
Create the image to use for the container.
*/}}
{{- define "sourcebot.image" -}}
{{- if $.Values.image.digest -}}
"{{ $.Values.image.repository }}@{{ $.Values.image.digest }}"
{{- else if $.Values.image.tag -}}
"{{ $.Values.image.repository }}:{{ $.Values.image.tag }}"
{{- else -}}
"{{ $.Values.image.repository }}:{{ $.Chart.AppVersion }}"
{{- end -}}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "sourcebot.serviceAccountName" -}}
{{- if $.Values.serviceAccount.create }}
{{- default (include "sourcebot.fullname" $) $.Values.serviceAccount.name }}
{{- else }}
{{- default "default" $.Values.serviceAccount.name }}
{{- end }}
{{- end }}
