import {Icon, Row, Text} from '../../../components';
import {Deposit} from '../../../types';
import {shortenHex} from '../../../utils/format';

type PendingTableRowProps = {
  deposit: Deposit;
};

// eslint-disable-next-line import/no-unused-modules
export const PendingTableRow: React.FC<PendingTableRowProps> = ({deposit}) => {
  return (
    <tr>
      <td>
        <a href="#">
          <Row $alignItems="center" $gap="xsmall">
            <Text.BodyStrong $color="inherit">{shortenHex(deposit.recipient)}</Text.BodyStrong>

            <Icon name="ExternalLink" color="inherit" size={18} />
          </Row>
        </a>
      </td>

      <td>
        <Text.BodyStrong>{deposit.amount.toString()}</Text.BodyStrong>
      </td>

      <td>
        <a href="#">
          <Row $alignItems="center" $gap="xsmall">
            <Text.BodyStrong $color="inherit">{shortenHex(deposit.origin.hash)}</Text.BodyStrong>

            <Icon name="ExternalLink" color="inherit" size={18} />
          </Row>
        </a>
      </td>
    </tr>
  );
};
