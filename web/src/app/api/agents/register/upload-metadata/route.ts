import { NextRequest, NextResponse } from 'next/server';
import { uploadAgentMetadata } from '@agent-marketplace/shared';
import type { ERC8004RegistrationFile, ERC8004Service } from '@agent-marketplace/shared';

interface UploadMetadataRequest {
  name: string;
  description: string;
  image: string;
  services: ERC8004Service[];
  x402Support?: boolean;
  category?: string;
}

function validateUrl(url: string, allowedProtocols = ['https:', 'http:']): boolean {
  try {
    const parsed = new URL(url);
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
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
      x402Support: body.x402Support ?? false,
      active: true,
      category: body.category,
    };

    const ipfsUri = await uploadAgentMetadata(metadata);

    return NextResponse.json({ ipfsUri });
  } catch (error) {
    console.error('Failed to upload metadata to IPFS:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
