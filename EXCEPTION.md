# The wirebench linking exception

Every plugin in this repository is licensed **GPL-3.0-or-later** (see
[LICENSE](LICENSE)) **with the additional permission below**, granted under
section 7 of that licence.

> **Additional permission under GNU GPL version 3 section 7**
>
> If you modify this program, or any covered work, by linking or combining it
> with wirebench (or a modified version of wirebench), containing parts
> covered by the terms of wirebench's licence, the licensors of this program
> grant you additional permission to convey the resulting work.

## Why it is here

wirebench is proprietary. A *code* plugin is Python that wirebench executes in
its own worker or sidecar, against the `wb` API — which is the one plugin
shape where the FSF's plugin doctrine bites: on their reading, a plugin loaded
into a host with intimate two-way data exchange forms a single program with
it. Without this permission, GPL and wirebench's licence would be in contact
and somebody would eventually have to argue about it.

Two things are true even without the exception, and they are worth stating so
nobody over-reads the risk:

- **Installing a plugin is never a problem.** Combining privately is not
  conveying (GPLv3 §2). Anyone may install any plugin, under any licence, on
  their own machine.
- **Nobody distributes the combination today.** wirebench does not host,
  mirror or bundle plugins; a plugin reaches a user as a file from whoever
  published it.

So the exception is not fixing a live problem. It removes a question that
would otherwise have to be answered every time somebody wanted to hand a
colleague wirebench and a plugin together — and it lets us recommend the same
thing to third-party authors without asking them to do something we have not
done ourselves.

## For plugin authors elsewhere

You are not required to use this. wirebench refuses no plugin on licence
grounds — it shows the licence and lets people decide. MIT, Apache-2.0 and
BSD-3 avoid the question entirely and are the easy answers. If you want GPL
*and* you want the combination to be distributable without argument, the
paragraph above is the shape; adapt it, and take your own advice on it.
