# latexmk config for paper/ (Makefile + LaTeX Workshop default recipe).
# Ensures TeX Live is on PATH when invoked from GUI apps (Cursor/VS Code).
$ENV{'PATH'} = '/Library/TeX/texbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:'
  . ($ENV{'PATH'} // '');

$pdf_mode = 1;
$do_cd = 1;
$synctex = 1;
$interaction = 'nonstopmode';
$file_line_error = 1;
