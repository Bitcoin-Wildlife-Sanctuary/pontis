import {Text} from '../Text';
import {Container, StyledTable} from './styled';

type TableProps = React.ComponentProps<typeof StyledTable> & {
  children: React.ReactNode;
  headings: string[];
};

export const Table: React.FC<TableProps> = ({children, headings, ...props}) => {
  return (
    <Container>
      <StyledTable {...props}>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th key={`${heading}-${index}`}>
                <Text.CardTitle $fontWeight={600}>{heading}</Text.CardTitle>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </StyledTable>
    </Container>
  );
};
