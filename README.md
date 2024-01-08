pict-rs-matrix
==============

**Warning: This is a proof-of-concept only. It does not implement the full Matrix media spec nor does it claim to be stable. Do not use in production.**

This is an experimental new "light" media repo that uses [pict-rs](https://git.asonix.dog/asonix/pict-rs) under the hood to handle the storage of media. This
process simply adds a flavour of Matrix by handling things like MXC uri resolution.

Implemented so far:

 - `/_matrix/media/v3/download/:serverName/:mediaId/:fileName?` (partial: fileName parameter not used.)