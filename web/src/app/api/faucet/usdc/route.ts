import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // TODO: Replace with your actual faucet API endpoint
    const faucetApiUrl = process.env.FAUCET_USDC_API_URL;

    if (!faucetApiUrl) {
      return NextResponse.json({ error: 'Faucet API not configured' }, { status: 500 });
    }

    // Call your faucet API
    const response = await fetch(faucetApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any authentication headers if needed
        // 'Authorization': `Bearer ${process.env.FAUCET_API_KEY}`,
      },
      body: JSON.stringify({
        address,
        amount: '100', // Adjust amount as needed (100 USDC)
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to request USDC from faucet' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: `Successfully sent USDC to ${address}`,
      txHash: data.txHash || data.transactionHash,
      ...data,
    });
  } catch (error) {
    console.error('Faucet USDC error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
