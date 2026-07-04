import { NextRequest, NextResponse } from 'next/server';
import { uploadAgentMetadata } from '@agent-marketplace/shared';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('Agent Register');
import type { ERC8004RegistrationFile, ERC8004Service } from '@agent-marketplace/shared';

interface UploadMetadataRequest {
  name: string;
  description: string;
  image: string;
  services: ERC8004Service[];
  category?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UploadMetadataRequest;

    if (!body.name || !body.description || !body.image) {
      return NextResponse.json(
        { error: 'name, description, and image are required' },
        { status: 400 }
      );
    }

    if (!body.services || body.services.length === 0) {
      return NextResponse.json(
        { error: 'At least one service is required' },
        { status: 400 }
      );
    }

    if (!validateUrl(body.image, ['https:'])) {
      return NextResponse.json(
        { error: 'Image URL must use HTTPS protocol' },
        { status: 400 }
      );
    }

    for (const service of body.services) {
      if (!validateUrl(service.endpoint, ['https:', 'http:'])) {
        return NextResponse.json(
          { error: `Invalid service endpoint: ${service.name}` },
          { status: 400 }
        );
      }
    }

    const metadata: ERC8004RegistrationFile = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: body.name,
      description: body.description,
      image: body.image,
      services: body.services,
      x402Support: true,
      active: true,
      category: body.category,
    };

    const ipfsUri = await uploadAgentMetadata(metadata);

    return NextResponse.json({ ipfsUri });
  } catch (error) {
    log.error('Failed to upload metadata to IPFS', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

function validateUrl(url: string, allowedProtocols = ['https:', 'http:']): boolean {
  try {
    const parsed = new URL(url);
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}
