import {ExplorerLink, Text} from '@/components';
import {Deposit} from '@/types';
import {shortenHex} from '@/utils/format';

type PendingTableRowProps = {
  deposit: Deposit;
};

export const PendingTableRow: React.FC<PendingTableRowProps> = ({deposit}) => {
  return (
    <tr>
      <td>
        <ExplorerLink network="l2" address={deposit.recipient}>
          <Text.BodyStrong $color="inherit">{shortenHex(deposit.recipient)}</Text.BodyStrong>
        </ExplorerLink>
      </td>

      <td>
        <Text.BodyStrong>{deposit.amount.toString()}</Text.BodyStrong>
      </td>

      <td>
        <ExplorerLink tx={deposit.origin}>
          <Text.BodyStrong $color="inherit">{shortenHex(deposit.origin.hash)}</Text.BodyStrong>
        </ExplorerLink>
      </td>
    </tr>
  );
};
