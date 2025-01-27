export interface Store {
  save<T>(
    txid: string,
    outputIndex: number,
    state: T,
    hash: string
  ): Promise<void>
  get<T>(
    txid: string,
    outputIndex: number
  ): Promise<{ state: T; hash: string } | null>
}

export class StateStore implements Store {
  private readonly store: Map<string, { state: any; hash: string }> = new Map()

  private key(txid: string, outputIndex: number) {
    return `${txid}:${outputIndex}`
  }

  async save<T>(txid: string, outputIndex: number, state: T, hash: string) {
    this.store.set(this.key(txid, outputIndex), { state, hash })
  }

  async get<T>(
    txid: string,
    outputIndex: number
  ): Promise<{ state: T; hash: string } | null> {
    const entry = this.store.get(this.key(txid, outputIndex))
    if (!entry) return null
    return { state: entry.state, hash: entry.hash }
  }
}

export const stateStore = new StateStore();