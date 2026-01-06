'use client';

import { ScoredToken } from '@/lib/types';
import { X, CheckCircle, XCircle, TrendingUp, Shield } from 'lucide-react';

interface WhyModalProps {
  token: ScoredToken;
  onClose: () => void;
}

export default function WhyModal({ token, onClose }: WhyModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {token.symbol}
              {token.isCleanGem ? (
                <span className="gem-badge is-gem">Clean Gem</span>
              ) : (
                <span className="gem-badge not-gem">Not a Gem</span>
              )}
            </h2>
            <p className="text-sm text-gray-400 mt-1">{token.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Shield size={16} />
              Risk Score
            </div>
            <div className={`text-3xl font-bold ${
              token.riskScore >= 75 ? 'text-gem-green' :
              token.riskScore >= 50 ? 'text-gem-yellow' : 'text-gem-red'
            }`}>
              {token.riskScore}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {token.riskScore >= 75 ? 'Low risk' :
               token.riskScore >= 50 ? 'Medium risk' : 'High risk'}
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <TrendingUp size={16} />
              Alpha Score
            </div>
            <div className={`text-3xl font-bold ${
              token.alphaScore >= 65 ? 'text-gem-green' :
              token.alphaScore >= 40 ? 'text-gem-yellow' : 'text-gem-red'
            }`}>
              {token.alphaScore}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {token.alphaScore >= 65 ? 'Strong momentum' :
               token.alphaScore >= 40 ? 'Moderate momentum' : 'Weak momentum'}
            </div>
          </div>
        </div>

        {/* Gate Criteria */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Clean Gem Gate Criteria
          </h3>
          <div className="space-y-2">
            {token.gateReasons.map((reason, index) => (
              <div
                key={index}
                className={`reason-item ${reason.passed ? 'passed' : 'failed'}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {reason.passed ? (
                    <CheckCircle size={18} className="text-gem-green" />
                  ) : (
                    <XCircle size={18} className="text-gem-red" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{reason.criterion}</span>
                    <span className="text-sm text-gray-400">
                      {reason.value} / {reason.threshold}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {reason.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token Details */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Token Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">Age</span>
              <span>{token.ageMinutes} min</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">Liquidity</span>
              <span>${token.liquidity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">Volume (5m)</span>
              <span>${token.volume5m.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">Volume (1h)</span>
              <span>${token.volume1h.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">Txns (5m)</span>
              <span>{token.txns5m} ({token.buys5m}B / {token.sells5m}S)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">Price</span>
              <span>${parseFloat(token.priceUsd.toString()).toFixed(8)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">FDV</span>
              <span>${token.fdv.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gem-border">
              <span className="text-gray-400">Price Change (1h)</span>
              <span className={token.priceChange1h >= 0 ? 'price-up' : 'price-down'}>
                {token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* History */}
        {token.history.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Recent History ({token.history.length} snapshots)
            </h3>
            <div className="max-h-32 overflow-y-auto text-xs font-mono bg-black/30 rounded-lg p-3">
              {token.history.slice(-5).reverse().map((snapshot, index) => (
                <div key={index} className="flex justify-between py-1 text-gray-400">
                  <span>{new Date(snapshot.timestamp).toLocaleTimeString()}</span>
                  <span>Liq: ${snapshot.liquidity.toLocaleString()}</span>
                  <span>Vol: ${snapshot.volume5m.toLocaleString()}</span>
                  <span>Txns: {snapshot.txns5m}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={token.dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gem-blue/20 text-gem-blue hover:bg-gem-blue/30 py-3 px-4 rounded-lg text-center font-medium transition-colors"
          >
            View on DexScreener
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(token.address)}
            className="bg-white/10 hover:bg-white/20 py-3 px-4 rounded-lg font-medium transition-colors"
          >
            Copy Address
          </button>
        </div>
      </div>
    </div>
  );
}
