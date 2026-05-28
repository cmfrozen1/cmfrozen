import React, { useState, useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';


function createData(name, calories, fat, carbs, protein) {
  return { name, calories, fat, carbs, protein };
}

const rows = [
  createData('Frozen yoghurt', 159, 6.0, 24, 4.0),
  createData('Ice cream sandwich', 237, 9.0, 37, 4.3),
  createData('Eclair', 262, 16.0, 24, 6.0),
  createData('Cupcake', 305, 3.7, 67, 4.3),
  createData('Gingerbread', 356, 16.0, 49, 3.9),
];



export default function Users() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch("https://www.mecallapi.com/api/users")
      .then(res => res.json())
      .then(
        (result) => {
          setItems(result);
        }
      )
  }, [])

  return (
    <React.Fragment>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ p: 2 }} >
        <Paper sx={{ p: 2 }} >
          <Box display="flex">
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>
                Users
      </Typography></Box>
            <Box>
              <Button variant="contained">Create</Button>
            </Box>
          </Box>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell align="right">First Name</TableCell>
                  <TableCell align="right">Last Name</TableCell>
                  <TableCell align="right">Username</TableCell>
                  <TableCell align="right">Avatar</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      {row.id}
                    </TableCell>
                    <TableCell align="right">{row.fname}</TableCell>
                    <TableCell align="right">{row.lname}</TableCell>
                    <TableCell align="right">{row.username}</TableCell>
                    <TableCell align="right">
                      <Box display="flex" justifyContent="flex-end">
                        <img src={row.avatar} alt={row.username} width={50} />
                      </Box>
                    </TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </React.Fragment>
  );
}
