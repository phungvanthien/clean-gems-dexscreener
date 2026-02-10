 'use client';

import axios from 'axios';
import {
  privateKeyToAccount,
  wrapAxiosWithPayment,
  decodePaymentResponse,
} from 'x402-stacks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK as 'mainnet' | 'testnet') || 'testnet';
const TTL_MS = 120 * 60 * 1000;

export type PremiumCleanGemsStatus = 'idle' | 'pending-key' | 'paying' | 'ready' | 'expired' | 'error';

export function usePremiumCleanGems(overridePrivateKey?: string) {
  const [cleanGems, setCleanGems] = useState<any[]>([]);
  const [status, setStatus] = useState<PremiumCleanGemsStatus>('idle');
  const [lastPaidAt, setLastPaidAt] = useState<number | null>(null);
  const [nextPaymentAt, setNextPaymentAt] = useState<number | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ transaction?: string; payer?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const account = useMemo(() => {
    const key = overridePrivateKey;
    if (!key) return null;
    try {
      return privateKeyToAccount(key.trim(), NETWORK);
    } catch {
      return null;
    }
  }, [overridePrivateKey]);

  const apiClient = useMemo(() => {
    if (!account) return null;
    return wrapAxiosWithPayment(
      axios.create({
        baseURL: '',
        timeout: 60000,
      }),
      account
    );
  }, [account]);

  const scheduleRefresh = useCallback(
    (paidAt: number) => {
    setLastPaidAt(paidAt);
    const next = paidAt + TTL_MS;
    setNextPaymentAt(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const delay = Math.max(0, next - Date.now());
    timeoutRef.current = setTimeout(() => {
      setStatus('expired');
    }, delay);
    },
    []
  );

  const fetchCleanGems = useCallback(async () => {
    if (!account) {
      setStatus('pending-key');
      return;
    }

    if (!apiClient) return;

    setStatus('paying');
    setErrorMessage(null);

    try {
      const response = await apiClient.get('/api/clean-gems');
      setCleanGems(response.data.cleanGems);
      const paymentResponse = decodePaymentResponse(response.headers['payment-response']);
      setPaymentInfo(paymentResponse ? { transaction: paymentResponse.transaction, payer: paymentResponse.payer } : null);
      scheduleRefresh(response.data.paidAt ?? Date.now());
      setStatus('ready');
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.response?.data?.error || error.message);
    }
  }, [account, apiClient, scheduleRefresh]);

  useEffect(() => {
    if (status === 'expired') {
      fetchCleanGems();
    }
  }, [status, fetchCleanGems]);

  useEffect(() => {
    if (status === 'idle') {
      fetchCleanGems();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status, fetchCleanGems]);

  return {
    cleanGems,
    status,
    paymentInfo,
    lastPaidAt,
    nextPaymentAt,
    errorMessage,
    refresh: fetchCleanGems,
  };
}
