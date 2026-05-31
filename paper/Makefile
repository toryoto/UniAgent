MAIN := sample-sigconf

.PHONY: all pdf clean distclean

all: pdf

pdf:
	latexmk -pdf -interaction=nonstopmode -file-line-error $(MAIN).tex

clean:
	latexmk -c $(MAIN).tex

distclean:
	latexmk -C $(MAIN).tex
