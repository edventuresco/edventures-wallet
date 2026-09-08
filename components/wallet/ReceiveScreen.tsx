import Link from "next/link";
import type { ReceiveState } from "@/app/receive/actions";
import { CopyButton } from "@/components/ui/CopyButton";
import { shortAddress } from "@/lib/wallet/receive";

/**
 * Where money comes in: the wallet's address to copy and a QR a wallet
 * app can scan (a Solana Pay request for the family's dollar). Only the
 * family's dollar arrives here; the copy says so.
 */
export function ReceiveScreen({ state }: { state: ReceiveState }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl text-forest">Receive</h1>
        <p className="text-sm text-ink/60">Share this to get dollars into your wallet. Only USDC on Solana lands here.</p>
      </header>

      {state.address && state.qrSvg ? (
        <section className="space-y-4 rounded-[22px] border border-sand-dark bg-white p-5">
          <div
            role="img"
            aria-label={`QR code for your wallet address ${state.address}`}
            className="mx-auto w-full max-w-[260px] [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: state.qrSvg }}
          />
          <p className="text-center">
            <span className="block text-sm text-ink/60">Your address</span>
            <span className="block font-mono text-lg text-ink" title={state.address}>
              {shortAddress(state.address)}
            </span>
          </p>
          <p className="break-all text-center font-mono text-xs text-ink/60">{state.address}</p>
          <div className="flex justify-center">
            <CopyButton text={state.address} />
          </div>
        </section>
      ) : (
        <section className="space-y-3 rounded-[22px] border border-sand-dark bg-white p-5">
          <p className="text-ink/70">You need a wallet first. It takes one tap.</p>
          <Link href="/wallet" className="inline-block text-sm font-semibold text-forest underline">
            Create my wallet
          </Link>
        </section>
      )}
    </div>
  );
}
