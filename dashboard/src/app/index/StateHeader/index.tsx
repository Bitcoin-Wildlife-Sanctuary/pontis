import {Col, ExplorerLink, GridCol, GridRow, Row} from '@/components';
import {OperatorState} from '@/types';
import {shortenHex} from '@/utils/format';
import {isAllZeroHex} from '@/utils/hex';

import {ContentCard} from '../styled';
import {Title, Value} from './styled';

export const StateHeader: React.FC<{state: OperatorState}> = ({state}) => {
  return (
    <GridRow className="g-xsmall">
      <GridCol flex lg={3} md={6} sm={12}>
        <Col $gap="xsmall" $flex={1}>
          <ContentCard $padding="small" $flex="1 1 max-content">
            <Col $flex={1} $justify="center" $gap="xxsmall">
              <Row $gap="xsmall" $alignItems="center">
                <Title>L1 Bridge Balance:</Title>
                <Value>{state.l1BridgeBalance}</Value>
              </Row>

              <Row $gap="xsmall" $alignItems="center">
                <Title>L2 Total Supply:</Title>
                <Value>{state.l2TotalSupply}</Value>
              </Row>
            </Col>
          </ContentCard>
        </Col>
      </GridCol>

      <GridCol flex lg={2} md={6} sm={12}>
        <Col $gap="xsmall" $flex={1}>
          <ContentCard $padding="small" $justify="center" $flex="1 1 max-content">
            <Col $flex={1} $justify="center" $gap="xxsmall">
              <Row $gap="xsmall" $alignItems="center">
                <Title>L1 Block:</Title>
                <Value>{state.l1BlockNumber ?? 0}</Value>
              </Row>

              <Row $gap="xsmall" $alignItems="center">
                <Title>L2 Block:</Title>
                <Value>{state.l2BlockNumber ?? 0}</Value>
              </Row>
            </Col>
          </ContentCard>
        </Col>
      </GridCol>

      {/* <GridCol flex lg={3} md={6} sm={12}>
        <ContentCard $padding="small" $flex={1}>
          <Col $flex={1} $justify="center" $gap="xsmall">
            <Row $gap="xsmall" $justify="space-between" $alignItems="center">
              <Title>Batches Root:</Title>
              <Value>{shortenHex(state.bridgeState.batchesRoot)}</Value>
            </Row> 

            <Row $gap="xsmall" $justify="space-between" $alignItems="center"> 
              <Title>Deposit SPK:</Title>
              <Value>{shortenHex(state.bridgeState.depositAggregatorSPK)}</Value>
            </Row>
          </Col>
        </ContentCard>
      </GridCol> */}

      <GridCol flex lg={7} md={12} sm={12}>
        <Col $gap="small" $flex={1}>
          <ContentCard $padding="small" $flex={1} $gap="xsmall">
            {/* <Title>Bridge State</Title> */}
            <Row $gap="xsmall" $justify="space-between" $alignItems="center">
              <Title>Latest Tx:</Title>

              <ExplorerLink tx={state.bridgeState.latestTx}>
                <Value $color="inherit">{shortenHex(state.bridgeState.latestTx.hash)}</Value>
              </ExplorerLink>
            </Row>

            <Row $gap="xsmall" $justify="space-between" $alignItems="center">
              <Title>Root:</Title>
              <Value>{shortenHex(state.bridgeState.batchesRoot)}</Value>
            </Row>

            <Row $gap="xxsmall" $flex={1} style={{flexWrap: 'wrap'}}>
              <Title>Leafs:</Title>
              {state.bridgeState.merkleTree.map((leaf, index) => {
                if (isAllZeroHex(leaf)) return null;

                return (
                  <Row key={leaf} $alignItems="center" $gap="xsmall" $flex={1}>
                    <Value>{index + 1}:</Value>

                    <Value>{shortenHex(leaf, 12)}</Value>
                  </Row>
                );
              })}
            </Row>
          </ContentCard>
        </Col>
      </GridCol>
    </GridRow>
  );
};
