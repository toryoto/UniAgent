import { prisma, Prisma } from './prisma';

interface AccessCheckResult {
  limited: boolean;
  reason?: 'ip' | 'wallet';
}

export async function checkAndUpdateAccessLimit(opts: {
  walletAddress: string;
  ipAddress: string;
  feature: string;
  ipLimit: number;
  walletLimit: number;
  windowMs: number;
  skipWalletLimit?: boolean;
}): Promise<AccessCheckResult> {
  const { walletAddress, ipAddress, feature, ipLimit, walletLimit, windowMs, skipWalletLimit } =
    opts;
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const [ipRecord, walletRecord] = await Promise.all([
        tx.accessLimit.findUnique({
          where: {
            idx_identifier_type_feature: {
              identifier: ipAddress,
              identifierType: 'ip',
              feature,
            },
          },
        }),
        tx.accessLimit.findUnique({
          where: {
            idx_identifier_type_feature: {
              identifier: walletAddress,
              identifierType: 'wallet',
              feature,
            },
          },
        }),
      ]);

      if (ipRecord) {
        const elapsed = now.getTime() - new Date(ipRecord.firstRequestAt).getTime();
        if (elapsed < windowMs && ipRecord.requestCount >= ipLimit) {
          return { limited: true, reason: 'ip' as const };
        }
      }

      if (!skipWalletLimit && walletRecord) {
        const elapsed = now.getTime() - new Date(walletRecord.firstRequestAt).getTime();
        if (elapsed < windowMs && walletRecord.requestCount >= walletLimit) {
          return { limited: true, reason: 'wallet' as const };
        }
      }

      const updatePromises = [];

      if (ipRecord) {
        const elapsed = now.getTime() - new Date(ipRecord.firstRequestAt).getTime();
        if (elapsed >= windowMs) {
          updatePromises.push(
            tx.accessLimit.update({
              where: { id: ipRecord.id },
              data: { firstRequestAt: now, requestCount: 1 },
            }),
          );
        } else {
          updatePromises.push(
            tx.accessLimit.update({
              where: { id: ipRecord.id },
              data: { requestCount: { increment: 1 } },
            }),
          );
        }
      } else {
        updatePromises.push(
          tx.accessLimit.create({
            data: {
              identifier: ipAddress,
              identifierType: 'ip',
              feature,
              firstRequestAt: now,
              requestCount: 1,
            },
          }),
        );
      }

      if (!skipWalletLimit) {
        if (walletRecord) {
          const elapsed = now.getTime() - new Date(walletRecord.firstRequestAt).getTime();
          if (elapsed >= windowMs) {
            updatePromises.push(
              tx.accessLimit.update({
                where: { id: walletRecord.id },
                data: { firstRequestAt: now, requestCount: 1 },
              }),
            );
          } else {
            updatePromises.push(
              tx.accessLimit.update({
                where: { id: walletRecord.id },
                data: { requestCount: { increment: 1 } },
              }),
            );
          }
        } else {
          updatePromises.push(
            tx.accessLimit.create({
              data: {
                identifier: walletAddress,
                identifierType: 'wallet',
                feature,
                firstRequestAt: now,
                requestCount: 1,
              },
            }),
          );
        }
      }

      await Promise.all(updatePromises);
      return { limited: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
