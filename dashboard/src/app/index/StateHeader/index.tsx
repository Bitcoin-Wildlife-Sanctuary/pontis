import NiceCatImage from '@/assets/nice-cat.jpeg';
import {Col, ExplorerLink, GridCol, GridRow, Row, Text} from '@/components';
import {shortenHex} from '@/utils/format';

import {ContentCard} from '../styled';
import {LogoImage} from './styled';

export const StateHeader: React.FC<{state: any}> = ({state}) => {
  return (
    <GridRow className="g-small">
      <GridCol flex lg={2} md={6} sm={12}>
        <ContentCard>
          <LogoImage src={NiceCatImage} alt="Nice Cat" />
        </ContentCard>
      </GridCol>

      <GridCol flex lg={2} md={6} sm={12}>
        <Col $gap="small" $flex={1}>
          <ContentCard $padding="small" $flex="1 1 max-content">
            <Col $flex={1} $justify="center">
              <Row $gap="xsmall">
                <Text.Subtitle>Total:</Text.Subtitle>
                <Text.Subtitle $color="textStrong">.....</Text.Subtitle>
              </Row>
            </Col>
          </ContentCard>

          <ContentCard $padding="small" $justify="center" $flex="1 1 max-content">
            <Col $flex={1} $justify="center" $gap="small">
              <Row $gap="xsmall">
                <Text.Subtitle>L1 Block:</Text.Subtitle>
                <Text.Subtitle $color="textStrong">{state?.l1BlockNumber ?? 0}</Text.Subtitle>
              </Row>

              <Row $gap="xsmall">
                <Text.Subtitle>L2 Block:</Text.Subtitle>
                <Text.Subtitle $color="textStrong">{state?.l2BlockNumber ?? 0}</Text.Subtitle>
              </Row>
            </Col>
          </ContentCard>
        </Col>
      </GridCol>

      <GridCol flex lg={3} md={6} sm={12}>
        <ContentCard $padding="small" $flex={1}>
          <Col $flex={1} $justify="center" $gap="small">
            <Row $gap="xsmall">
              <Text.Subtitle>Latest TX:</Text.Subtitle>
              <ExplorerLink tx={state?.bridgeState.latestTx}>
                <Text.Subtitle $color="inherit">{shortenHex(state?.bridgeState.latestTx.hash)}</Text.Subtitle>
              </ExplorerLink>
            </Row>

            <Row $gap="xsmall">
              <Text.Subtitle>Batches Root:</Text.Subtitle>
              <Text.Subtitle $color="textStrong">{shortenHex(state?.bridgeState.batchesRoot)}</Text.Subtitle>
            </Row>

            <Row $gap="xsmall">
              <Text.Subtitle>Deposit SPK:</Text.Subtitle>
              <Text.Subtitle $color="textStrong">{shortenHex(state?.bridgeState.depositAggregatorSPK)}</Text.Subtitle>
            </Row>
          </Col>
        </ContentCard>
      </GridCol>

      <GridCol flex lg={5} md={6} sm={12}>
        <Col $gap="small" $flex={1}>
          <ContentCard $padding="small" $flex={1} $justify="center">
            <Text.Subtitle>Merkle Tree</Text.Subtitle>
          </ContentCard>

          <Col $flex={1} />
        </Col>
      </GridCol>
    </GridRow>
  );
};
