import type { PackageMetadata, RepoMetadata } from '../core/types.js';

export interface ConfidenceAssessment {
  readonly confidence: number;
  readonly isConfident: boolean;
  readonly components: {
    readonly registry: number;
    readonly repo: number;
    readonly runtime: number;
    readonly provenance: number;
  };
}

export function computeConfidence(
  packageMeta: PackageMetadata,
  repoMeta: RepoMetadata,
  minConfidenceThreshold = 0.35,
): ConfidenceAssessment {
  let registryScore = 0;
  if (packageMeta.publishedAt && packageMeta.version) {
    registryScore = 0.40;
  }

  let repoScore = 0;
  if (repoMeta.associationStatus === 'verified') {
    repoScore = 0.35;
  } else if (repoMeta.associationStatus === 'unverified') {
    repoScore = 0.15;
  }

  let runtimeScore = 0;
  if (packageMeta.engines?.node) {
    runtimeScore = 0.15;
  }

  let provenanceScore = 0;
  if (packageMeta.hasProvenance) {
    provenanceScore = 0.10;
  }

  const rawSum = registryScore + repoScore + runtimeScore + provenanceScore;
  const confidence = Number(Math.min(1.0, Math.max(0.0, rawSum)).toFixed(2));
  const isConfident = confidence >= minConfidenceThreshold;

  return {
    confidence,
    isConfident,
    components: {
      registry: registryScore,
      repo: repoScore,
      runtime: runtimeScore,
      provenance: provenanceScore,
    },
  };
}
